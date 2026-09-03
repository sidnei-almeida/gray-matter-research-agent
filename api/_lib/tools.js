/** Tool implementations and multi-tool execution. */

import { evaluate } from 'mathjs';

import {
  formatStructuredResultForAgent,
  resolveArxivTopic,
  searchScientificPapersStructured,
  wantsRecentPapers,
} from './arxivSearch.js';
import { isExplicitPaperRequest, isToolingIntent, RECENT_KEYWORDS } from './router.js';
import { searchWeb } from './webSearch.js';
import { lookupWikipedia } from './wikipedia.js';

// Execution order: web/wikipedia before arXiv unless it is an explicit paper search.
const TOOL_ORDER_PAPER_FIRST = ['arxiv', 'web_search', 'wikipedia', 'calculator'];
const TOOL_ORDER_WEB_FIRST = ['web_search', 'wikipedia', 'arxiv', 'calculator'];

export function makeEvidence(fields) {
  return {
    title: '',
    url: '',
    source_type: 'web',
    snippet: '',
    relevance_score: 0,
    used_in_answer: false,
    metadata: {},
    ...fields,
  };
}

function toolExecutionOrder(state) {
  const intent = state.intent?.intent || 'general_chat';
  const required = state.intent?.tools_required || [];

  const paperFirst =
    intent === 'paper_search' ||
    (required.includes('arxiv') && isExplicitPaperRequest(state.user_query));

  const base = paperFirst ? TOOL_ORDER_PAPER_FIRST : TOOL_ORDER_WEB_FIRST;

  const ordered = base.filter((t) => required.includes(t));
  for (const tool of required) {
    if (!ordered.includes(tool)) ordered.push(tool);
  }
  return ordered;
}

function arxivWeakOrClarification(structured) {
  if (structured?.type === 'clarification') return true;
  const papers = structured?.papers || [];
  return structured?.type === 'paper_results' && papers.length === 0;
}

function shouldContinueAfterWeakArxiv(state) {
  if (!state.intent) return false;
  if (isToolingIntent(state.intent.intent)) return true;
  if (state.intent.intent === 'concept_explanation') return true;
  return !isExplicitPaperRequest(state.user_query);
}

// --- Individual tools ---

export function calculator(expression) {
  try {
    // Preserve the Python behaviour where `log` is base-10 and `ln` is natural log.
    const normalized = String(expression).replace(
      /\b(log10|log|ln)\b/g,
      (match) => (match === 'ln' ? 'log' : 'log10')
    );
    const result = evaluate(normalized);
    return String(result);
  } catch (error) {
    return `Calculation error: ${error.message}`;
  }
}

export function extractCalcExpression(query) {
  const patterns = [
    /(?:calculate|compute|eval(?:uate)?)\s+(.+)/i,
    /(?:what is|how much is)\s+([\d\s+\-*/().^]+)/i,
  ];
  for (const pattern of patterns) {
    const match = String(query).match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  const matches = String(query).match(/[\d+\-*/().^\s]+/g) || [];
  if (matches.length && ['+', '-', '*', '/', '='].some((c) => query.includes(c))) {
    return matches.reduce((a, b) => (b.length > a.length ? b : a)).trim();
  }
  return null;
}

/**
 * @param {string} input a bare expression, or a sentence to extract one from
 * @param {{extract?: boolean}} options set `extract` when `input` is prose
 */
export function runCalculator(input, { extract = false } = {}) {
  const expr = (extract ? extractCalcExpression(input) : null) || input;
  const result = calculator(expr);
  return makeEvidence({
    title: `Calculation: ${expr}`,
    url: '',
    source_type: 'calculation',
    snippet: result,
    relevance_score: 1.0,
    metadata: { expression: expr, result },
  });
}

export async function runWikipedia(query) {
  const article = await lookupWikipedia(query);
  if (!article) return [];

  return [
    makeEvidence({
      title: `Wikipedia: ${article.title}`,
      url: article.url,
      source_type: 'wikipedia',
      snippet: article.summary.slice(0, 800),
      relevance_score: 0.75,
    }),
  ];
}

export async function runWeb(query, maxResults = 5) {
  const { results, provider } = await searchWeb(query, maxResults);

  return results.map((r, i) =>
    makeEvidence({
      title: r.title || `Web result ${i + 1}`,
      url: r.url,
      source_type: 'web',
      snippet: String(r.snippet || '').slice(0, 800),
      relevance_score: Math.max(0.5, 0.85 - i * 0.1),
      metadata: { provider },
    })
  );
}

export async function runArxiv(
  query,
  { userQuery = null, depth = 'standard', recentOnly = false, maxPapers = null } = {}
) {
  const original = userQuery || query;
  const topic = resolveArxivTopic(original, query);
  const resolvedMaxPapers = maxPapers ?? (depth === 'deep' ? 5 : 3);

  const structured = await searchScientificPapersStructured(topic, {
    maxPapers: resolvedMaxPapers,
    recentOnly: recentOnly || wantsRecentPapers(original),
  });

  const evidence = [];
  if (structured?.type === 'paper_results') {
    for (const paper of structured.papers || []) {
      const score = paper.relevanceScore || 0;
      evidence.push(
        makeEvidence({
          title: paper.title || '',
          url: paper.url || '',
          source_type: 'arxiv',
          snippet: String(paper.summary || '').slice(0, 600),
          relevance_score: Math.min(1.0, score / 20.0),
          metadata: {
            authors: paper.authors,
            year: paper.year,
            categories: paper.categories,
            whyItMatches: paper.whyItMatches,
            pdfUrl: paper.pdfUrl,
          },
        })
      );
    }
  }

  return { formatted: formatStructuredResultForAgent(structured), structured, evidence };
}

// --- Orchestration ---

async function runWebFallback(state, query) {
  if (state.tools_used.includes('web_search')) return;
  try {
    const evs = await runWeb(query);
    state.tools_used.push('web_search');
    state.evidence.push(...evs);
    state.limitations.push(
      'arXiv had no strong matches; supplemented with web search for tooling context.'
    );
  } catch (error) {
    console.warn('Web fallback failed:', error.message);
    state.limitations.push('Web fallback search encountered an error.');
  }
}

export async function executeTools(state) {
  if (!state.intent) return state;

  const query = state.intent.query_rewrite || state.user_query;
  const tools = toolExecutionOrder(state);
  const recent = RECENT_KEYWORDS.some((kw) => query.toLowerCase().includes(kw));
  let arxivWeak = false;

  for (const tool of tools) {
    try {
      if (tool === 'calculator') {
        state.tools_used.push('calculator');
        state.evidence.push(runCalculator(query, { extract: true }));
      } else if (tool === 'wikipedia') {
        const evs = await runWikipedia(query);
        state.tools_used.push('wikipedia');
        state.evidence.push(...evs);
      } else if (tool === 'web_search') {
        const evs = await runWeb(query);
        state.tools_used.push('web_search');
        state.evidence.push(...evs);
      } else if (tool === 'arxiv') {
        const { structured, evidence } = await runArxiv(query, {
          userQuery: state.user_query,
          depth: state.depth,
          recentOnly: recent,
        });
        state.paper_search = structured;

        if (arxivWeakOrClarification(structured)) {
          arxivWeak = true;
          if (shouldContinueAfterWeakArxiv(state)) {
            state.limitations.push(
              'arXiv search did not return strong paper matches ' +
                '(not required for tooling/technology questions).'
            );
            continue;
          }

          state.tools_used.push('search_scientific_papers');
          state.intent.needs_clarification = true;
          state.intent.clarification_question = structured.message || '';
          const options = structured.options || [];
          if (options.length) {
            state.intent.clarification_question +=
              '\n\n' + options.map((o) => `- ${o}`).join('\n');
          }
          return state;
        }

        state.tools_used.push('search_scientific_papers');
        state.papers = structured.papers || [];
        state.evidence.push(...evidence);
      }
    } catch (error) {
      console.warn(`Tool ${tool} failed:`, error.message);
      state.limitations.push(`${tool} search encountered an error.`);
    }
  }

  if (arxivWeak && shouldContinueAfterWeakArxiv(state)) {
    await runWebFallback(state, state.user_query);
  }

  if (
    state.depth === 'deep' &&
    state.intent?.tools_optional?.includes('arxiv') &&
    !state.tools_used.includes('search_scientific_papers')
  ) {
    try {
      const { structured, evidence } = await runArxiv(query, {
        userQuery: state.user_query,
        depth: state.depth,
        recentOnly: recent,
      });
      state.paper_search = structured;
      if (!arxivWeakOrClarification(structured)) {
        state.tools_used.push('search_scientific_papers');
        state.papers = structured.papers || [];
        state.evidence.push(...evidence);
      }
    } catch (error) {
      console.warn('Optional arXiv (deep) failed:', error.message);
    }
  }

  return state;
}
