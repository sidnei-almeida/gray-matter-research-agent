/**
 * Tool definitions the model sees, plus the dispatcher that runs them.
 *
 * The underlying implementations live in `tools.js`; this module only wraps
 * them in OpenAI-shaped function schemas and renders compact, model-facing
 * summaries. Evidence objects are returned alongside so the pipeline can rank
 * and cite them without re-parsing the text the model read.
 */

import { runArxiv, runCalculator, runWeb, runWikipedia } from './tools.js';

/** Function schemas passed as `tools` on every agent-loop turn. */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the live web for current context, product docs, tooling comparisons, ' +
        'news and anything that changes over time. Use this first for questions about ' +
        'libraries, frameworks, vector databases, platforms or recent events.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Focused search query. Keywords, not a full sentence.',
          },
          max_results: {
            type: 'integer',
            description: 'How many results to retrieve (1-8). Defaults to 5.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wikipedia_lookup',
      description:
        'Fetch an encyclopedic summary for a well-established concept, person, ' +
        'organism, element or historical event. Use for background and definitions, ' +
        'not for anything recent or product-specific.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The article subject, e.g. "methamphetamine" or "catalysis".',
          },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'arxiv_search',
      description:
        'Search arXiv for peer-review-track scientific papers and return ranked ' +
        'results with relevance reasoning. Use ONLY when the user wants papers, ' +
        'studies, literature or academic benchmarks — not for tooling questions.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The research topic alone, stripped of phrasing like "find papers about".',
          },
          recent_only: {
            type: 'boolean',
            description: 'Restrict to recent publications when the user asked for latest work.',
          },
          max_papers: {
            type: 'integer',
            description: 'How many papers to return (1-8). Defaults to 3.',
          },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description:
        'Evaluate a mathematical expression deterministically. Use for any arithmetic, ' +
        'unit conversion, stoichiometry or numeric result instead of computing it yourself. ' +
        '`log` is base-10 and `ln` is natural log.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'A mathjs-compatible expression, e.g. "(2.4 * 6.022e23) / 180.16".',
          },
        },
        required: ['expression'],
        additionalProperties: false,
      },
    },
  },
];

/** Tool name → the label surfaced to the UI and to the legacy `tools_used` list. */
export const TOOL_USED_LABELS = {
  web_search: 'web_search',
  wikipedia_lookup: 'wikipedia',
  arxiv_search: 'search_scientific_papers',
  calculate: 'calculator',
};

/** Human-readable trace line for the research plan. */
export function describeToolCall(name, args) {
  switch (name) {
    case 'web_search':
      return `Search the web for "${args.query}"`;
    case 'wikipedia_lookup':
      return `Look up "${args.topic}" on Wikipedia`;
    case 'arxiv_search':
      return `Search arXiv for "${args.topic}"${args.recent_only ? ' (recent only)' : ''}`;
    case 'calculate':
      return `Evaluate ${args.expression}`;
    default:
      return `Run ${name}`;
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function renderEvidenceForModel(evidence, header) {
  if (!evidence.length) return `${header}: no results.`;

  const lines = [header];
  evidence.forEach((item, i) => {
    lines.push(`[${i + 1}] ${item.title}`);
    if (item.url) lines.push(`    url: ${item.url}`);
    lines.push(`    ${String(item.snippet).replace(/\s+/g, ' ').slice(0, 400)}`);
  });
  return lines.join('\n');
}

/**
 * Execute one tool call requested by the model.
 *
 * @param {string} name tool name from the model
 * @param {object} args parsed arguments
 * @param {object} state agent state (for depth and the original query)
 * @returns {Promise<{content: string, evidence: Array, papers?: Array, paperSearch?: object}>}
 */
export async function executeToolCall(name, args, state) {
  switch (name) {
    case 'web_search': {
      const query = String(args.query || '').trim();
      if (!query) return { content: 'web_search: `query` is required.', evidence: [] };

      const evidence = await runWeb(query, clampInt(args.max_results, 1, 8, 5));
      return {
        content: renderEvidenceForModel(evidence, `Web results for "${query}"`),
        evidence,
      };
    }

    case 'wikipedia_lookup': {
      const topic = String(args.topic || '').trim();
      if (!topic) return { content: 'wikipedia_lookup: `topic` is required.', evidence: [] };

      const evidence = await runWikipedia(topic);
      return {
        content: renderEvidenceForModel(evidence, `Wikipedia summary for "${topic}"`),
        evidence,
      };
    }

    case 'arxiv_search': {
      const topic = String(args.topic || '').trim();
      if (!topic) return { content: 'arxiv_search: `topic` is required.', evidence: [] };

      const { formatted, structured, evidence } = await runArxiv(topic, {
        userQuery: state.user_query,
        depth: state.depth,
        recentOnly: Boolean(args.recent_only),
        maxPapers: clampInt(args.max_papers, 1, 8, state.depth === 'deep' ? 5 : 3),
      });

      return {
        content: formatted || renderEvidenceForModel(evidence, `arXiv results for "${topic}"`),
        evidence,
        papers: structured?.papers || [],
        paperSearch: structured,
      };
    }

    case 'calculate': {
      const expression = String(args.expression || '').trim();
      if (!expression) return { content: 'calculate: `expression` is required.', evidence: [] };

      const item = runCalculator(expression);
      return {
        content: `${expression} = ${item.metadata.result}`,
        evidence: [item],
      };
    }

    default:
      return { content: `Unknown tool "${name}".`, evidence: [] };
  }
}
