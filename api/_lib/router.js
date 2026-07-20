/** Intent classification — LLM with heuristic fallback and tooling-aware overrides. */

import { chatComplete } from './llm.js';
import { extractPaperTopic, isValidPaperTopic } from './arxivSearch.js';

export const INTENTS = [
  'concept_explanation',
  'paper_search',
  'web_research',
  'technology_discovery',
  'tool_comparison',
  'calculation',
  'comparative_research',
  'mixed_research',
  'general_chat',
];

export const TOOL_NAMES = ['arxiv', 'wikipedia', 'web_search', 'calculator'];

// Domain signals for RAG / vector DB / tooling questions (not academic paper search).
const TOOLING_DOMAIN_KEYWORDS = [
  'faiss', 'vector database', 'vector databases', 'vector store', 'vector db',
  'vector dbs', 'embeddings', 'embedding model', 'semantic search',
  'retrieval augmented', 'retrieval-augmented', 'chroma', 'qdrant', 'milvus',
  'weaviate', 'pinecone', 'lancedb', 'pgvector', 'elasticsearch vector',
  'opensearch vector', 'vespa', 'vectorizing', 'vectorization', 'vectorisation',
  'similarity search', 'ann index', 'hnsw',
];

const TOOLING_ACTION_KEYWORDS = [
  'alternative', 'alternatives', 'replace', 'replaces', 'replacing',
  'replacement', 'best ', ' tool', 'tools ', 'library', 'libraries',
  'framework', 'platform', 'database', 'databases', 'production', 'deploy',
  'deployment', 'stack', 'new technology', 'new stack',
];

const PAPER_EXPLICIT_KEYWORDS = [
  'paper', 'papers', 'arxiv', 'artigo', 'research paper',
  'scientific literature', 'publication', 'publications', 'research article',
  'peer-reviewed', 'find studies', 'find papers', 'recent papers',
];

const COMPARE_KEYWORDS = ['compare', 'versus', ' vs ', ' vs.', 'difference between', 'contrast'];

export const RECENT_KEYWORDS = ['latest', 'recent', 'current', 'new', '2024', '2025', '2026'];

const EXPLAIN_KEYWORDS = ['what is', 'who is', 'explain', 'define', 'tell me about', 'how does'];

const CLASSIFIER_PROMPT = `Classify the user query for a research agent (science + technology tooling).

Return ONLY valid JSON with keys:
- intent: one of {intents}
- tools_required: array from ["arxiv","wikipedia","web_search","calculator"]
- tools_optional: array (same values) — tools that may run only as complement
- needs_clarification: boolean
- clarification_question: string (empty if not needed)
- research_depth: one of "quick","standard","deep"
- query_rewrite: clearer search-friendly version of the query
- reason: short string explaining the routing choice

Routing rules (critical):
1. Questions about tools, libraries, platforms, frameworks, vector databases, or alternatives
   (FAISS, Qdrant, Milvus, RAG stacks, embeddings, production deploy) are NOT paper_search.
   Use intent "technology_discovery" or "tool_comparison" with tools_required including "web_search".
   Put "arxiv" in tools_optional only, never as the only required tool, unless the user explicitly asks for papers.

2. Use "paper_search" or require "arxiv" only when the user asks for papers, arXiv, studies,
   scientific literature, publications, or benchmarks from research articles.

3. "What is X" / "explain" / "define" → concept_explanation; prefer wikipedia optional, not required arxiv.

4. "latest/new/current" about **tools or technologies** → web_search first, not arxiv first.

5. Comparisons like "Qdrant vs Milvus" → tool_comparison + web_search.

User query: {query}
`;

/** @returns {object} a fresh IntentResult */
export function makeIntent(fields = {}) {
  return {
    intent: 'general_chat',
    tools_required: [],
    tools_optional: [],
    needs_clarification: false,
    clarification_question: '',
    research_depth: 'standard',
    query_rewrite: '',
    reason: '',
    ...fields,
  };
}

export function isExplicitPaperRequest(query) {
  const q = String(query || '').toLowerCase();
  if (PAPER_EXPLICIT_KEYWORDS.some((kw) => q.includes(kw))) return true;
  return Boolean(extractPaperTopic(query));
}

function hasRagKeyword(query) {
  return /\brag\b/i.test(String(query || ''));
}

export function isToolingDomainQuery(query) {
  const q = String(query || '').toLowerCase();
  if (hasRagKeyword(query)) return true;
  if (TOOLING_DOMAIN_KEYWORDS.some((kw) => q.includes(kw))) return true;
  if (q.includes('vector') && ['database', 'store', 'db', 'search', 'index'].some((w) => q.includes(w))) {
    return true;
  }
  return false;
}

export function isToolingActionQuery(query) {
  const q = String(query || '').toLowerCase();
  return TOOLING_ACTION_KEYWORDS.some((kw) => q.includes(kw));
}

/** Technology discovery / vector DB / RAG stack questions — web-first, not arXiv-first. */
export function isToolingQuery(query) {
  if (!isToolingDomainQuery(query)) return false;
  const q = String(query || '').toLowerCase();
  if (isToolingActionQuery(query)) return true;
  if (RECENT_KEYWORDS.some((kw) => q.includes(kw))) return true;
  return q.includes('technology') || q.includes('technologies');
}

export function isToolComparisonQuery(query) {
  const q = String(query || '').toLowerCase();
  if (!COMPARE_KEYWORDS.some((kw) => q.includes(kw))) return false;
  return (
    isToolingDomainQuery(query) ||
    ['database', 'vector', 'library', 'framework', 'tool', 'stack'].some((w) => q.includes(w))
  );
}

export function isToolingIntent(intent) {
  return ['technology_discovery', 'tool_comparison', 'web_research'].includes(intent);
}

function normalizeTools(tools) {
  const seen = new Set();
  const out = [];
  for (const t of tools || []) {
    if (TOOL_NAMES.includes(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Ensure web_search is required first; demote arxiv to optional unless explicit papers. */
function webFirstTools(required, optional = []) {
  let req = normalizeTools(required);
  const opt = normalizeTools(optional);

  if (req.includes('arxiv')) {
    req = req.filter((t) => t !== 'arxiv');
    if (!opt.includes('arxiv')) opt.push('arxiv');
  }

  if (!req.includes('web_search')) req.unshift('web_search');
  if (!req.includes('wikipedia') && !opt.includes('wikipedia')) opt.unshift('wikipedia');

  return [req, opt];
}

/** Post-process classifier/heuristic output for consistent tooling vs paper routing. */
export function applyRoutingOverrides(result, query) {
  const q = String(query || '').toLowerCase();

  if (isExplicitPaperRequest(query)) {
    const tools = [...result.tools_required];
    if (!tools.includes('arxiv')) tools.unshift('arxiv');
    if (RECENT_KEYWORDS.some((kw) => q.includes(kw)) && !tools.includes('web_search')) {
      tools.push('web_search');
    }
    const topic = extractPaperTopic(query) || result.query_rewrite || query;
    result.intent = tools.length > 1 ? 'mixed_research' : 'paper_search';
    result.tools_required = normalizeTools(tools);
    result.tools_optional = normalizeTools(result.tools_optional);
    if (isValidPaperTopic(topic)) result.query_rewrite = topic;
    return result;
  }

  if (isToolComparisonQuery(query)) {
    const [req, opt] = webFirstTools(['web_search']);
    result.intent = 'tool_comparison';
    result.tools_required = req;
    result.tools_optional = opt;
    result.needs_clarification = false;
    result.clarification_question = '';
    return result;
  }

  if (isToolingQuery(query)) {
    const [req, opt] = webFirstTools(['web_search']);
    result.intent = isToolComparisonQuery(query) ? 'tool_comparison' : 'technology_discovery';
    result.tools_required = req;
    result.tools_optional = opt;
    result.needs_clarification = false;
    result.clarification_question = '';
    return result;
  }

  // Demote arxiv-only misroutes when the query is clearly tooling-related
  if (['paper_search', 'mixed_research'].includes(result.intent) && isToolingDomainQuery(query)) {
    if (!isExplicitPaperRequest(query)) {
      const [req, opt] = webFirstTools(result.tools_required, result.tools_optional);
      result.intent = 'technology_discovery';
      result.tools_required = req;
      result.tools_optional = opt;
      result.needs_clarification = false;
      result.clarification_question = '';
    }
  }

  if (['technology_discovery', 'tool_comparison', 'web_research'].includes(result.intent)) {
    const [req, opt] = webFirstTools(result.tools_required, result.tools_optional);
    result.tools_required = req;
    result.tools_optional = opt;
  }

  return result;
}

function heuristicClassify(query, depth = 'standard') {
  const q = String(query || '').toLowerCase().trim();

  const looksMathy =
    ['calculate', 'compute', 'sqrt', 'sin(', 'cos('].some((kw) => q.includes(kw)) ||
    (/[\d+\-*/^=]/.test(q) && ['+', '-', '*', '/', '='].some((c) => q.includes(c)));

  if (looksMathy) {
    return makeIntent({
      intent: 'calculation',
      tools_required: ['calculator'],
      research_depth: depth,
      query_rewrite: query,
      reason: 'Mathematical expression detected.',
    });
  }

  if (isExplicitPaperRequest(query)) {
    const tools = ['arxiv'];
    if (RECENT_KEYWORDS.some((kw) => q.includes(kw))) tools.push('web_search');
    const topic = extractPaperTopic(query) || query;
    return applyRoutingOverrides(
      makeIntent({
        intent: tools.length > 1 ? 'mixed_research' : 'paper_search',
        tools_required: tools,
        research_depth: depth === 'deep' ? 'deep' : depth,
        query_rewrite: topic,
        reason: 'Explicit paper or arXiv request.',
      }),
      query
    );
  }

  if (EXPLAIN_KEYWORDS.some((kw) => q.includes(kw)) && !isToolComparisonQuery(query)) {
    return applyRoutingOverrides(
      makeIntent({
        intent: 'concept_explanation',
        tools_required: ['wikipedia'],
        tools_optional: isToolingDomainQuery(query) ? ['web_search'] : [],
        research_depth: depth,
        query_rewrite: query,
        reason: 'Explanation or definition request.',
      }),
      query
    );
  }

  if (isToolComparisonQuery(query)) {
    const [req, opt] = webFirstTools(['web_search']);
    return makeIntent({
      intent: 'tool_comparison',
      tools_required: req,
      tools_optional: opt,
      research_depth: depth,
      query_rewrite: query,
      reason: 'Tool or platform comparison detected.',
    });
  }

  if (isToolingQuery(query)) {
    const [req, opt] = webFirstTools(['web_search']);
    return makeIntent({
      intent: 'technology_discovery',
      tools_required: req,
      tools_optional: opt,
      research_depth: depth,
      query_rewrite: query,
      reason: 'Technology or vector/RAG tooling discovery query.',
    });
  }

  if (COMPARE_KEYWORDS.some((kw) => q.includes(kw))) {
    return applyRoutingOverrides(
      makeIntent({
        intent: 'comparative_research',
        tools_required: ['web_search', 'wikipedia'],
        tools_optional: ['arxiv'],
        research_depth: depth,
        query_rewrite: query,
        reason: 'General comparison (non-tooling-specific).',
      }),
      query
    );
  }

  if (RECENT_KEYWORDS.some((kw) => q.includes(kw))) {
    const tools = ['web_search'];
    if (['agent', 'llm', 'model'].some((kw) => q.includes(kw)) && !isToolingDomainQuery(query)) {
      tools.push('arxiv');
    }
    return applyRoutingOverrides(
      makeIntent({
        intent: tools.includes('arxiv') ? 'mixed_research' : 'web_research',
        tools_required: tools,
        research_depth: depth,
        query_rewrite: query,
        reason: 'Recency-focused query; web first unless academic papers requested.',
      }),
      query
    );
  }

  return makeIntent({
    intent: 'general_chat',
    tools_required: [],
    research_depth: depth,
    query_rewrite: query,
    reason: 'No specialized tools required.',
  });
}

function parseClassifierJson(text) {
  const match = String(text || '').trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** LLM classification with safe heuristic fallback and routing overrides. */
export async function classifyIntent(query, depth = 'standard') {
  const prompt = CLASSIFIER_PROMPT
    .replace('{intents}', INTENTS.join(', '))
    .replace('{query}', query);

  try {
    const content = await chatComplete([
      {
        role: 'system',
        content:
          'You classify research and technology queries. ' +
          'Route vector DB / RAG tooling questions to web_search, not arXiv-only. ' +
          'Return JSON only.',
      },
      { role: 'user', content: prompt },
    ]);

    const data = parseClassifierJson(content);
    if (data) {
      let intent = data.intent || 'general_chat';
      if (!INTENTS.includes(intent)) intent = 'general_chat';

      const tools = normalizeTools(data.tools_required || []);
      const optional = normalizeTools(data.tools_optional || []);

      let rd = data.research_depth || depth;
      if (!['quick', 'standard', 'deep'].includes(rd)) rd = depth;

      let rewrite = String(data.query_rewrite || query).trim();
      if (!isToolingQuery(query) && !isExplicitPaperRequest(query)) {
        const extracted = extractPaperTopic(query);
        if (extracted && isValidPaperTopic(extracted)) {
          rewrite = extracted;
        } else if (!isValidPaperTopic(rewrite)) {
          rewrite = extracted || query;
        }
      } else if (!isValidPaperTopic(rewrite)) {
        rewrite = query;
      }

      const result = makeIntent({
        intent,
        tools_required: tools,
        tools_optional: optional,
        needs_clarification: Boolean(data.needs_clarification),
        clarification_question: String(data.clarification_question || ''),
        research_depth: rd,
        query_rewrite: rewrite,
        reason: String(data.reason || ''),
      });

      return applyRoutingOverrides(result, query);
    }
  } catch (error) {
    console.warn('Intent classifier LLM failed, using heuristics:', error.message);
  }

  return applyRoutingOverrides(heuristicClassify(query, depth), query);
}
