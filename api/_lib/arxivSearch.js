/**
 * ArXiv search pipeline: ambiguity detection, query expansion, relevance scoring, filtering.
 * Talks to the public arXiv Atom API directly.
 */

import { XMLParser } from 'fast-xml-parser';

const ARXIV_API = 'https://export.arxiv.org/api/query';
const ARXIV_FETCH_MAX = 12;
const MIN_RELEVANCE_SCORE = 6;
const MAX_RETURN_PAPERS = 3;
const MAX_RETURN_PAPERS_DEEP = 5;
const RECENT_YEAR_CUTOFF = 2023; // papers from this year onward when "recent" requested
const ARXIV_TIMEOUT_MS = Number(process.env.ARXIV_TIMEOUT_MS || 12000);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'about', 'on', 'for', 'of', 'me', 'um', 'uma',
  'paper', 'papers', 'artigo', 'artigos', 'find', 'get', 'send', 'manda',
  'envia', 'recent', 'latest', 'some', 'sobre', 'research', 'study',
  'studies', 'please', 'por', 'favor',
]);

// Queries too broad to search without clarification
const AMBIGUOUS_PHRASES = new Set([
  'human interactions', 'human interaction', 'human behaviors', 'human behavior',
  'interactions', 'interaction', 'ai', 'cancer', 'climate', 'robots', 'robot',
]);

const VAGUE_SINGLE_TERMS = new Set(['ai', 'cancer', 'climate', 'robots', 'robot']);

export const CLARIFICATION_OPTIONS_HUMAN_INTERACTION = [
  'Human-computer interaction',
  'Human-AI interaction',
  'Human-robot interaction',
  'Social/behavioral interaction',
];

const CLARIFICATION_MESSAGE_HUMAN_INTERACTION =
  'Human interactions is broad. Do you mean human-computer interaction, ' +
  'human-AI interaction, human-robot interaction, or social/behavioral interaction?';

const INTENT_CATEGORY_PRIORITY = {
  hci: { 'cs.HC': 5, 'cs.AI': 1, 'cs.RO': 0, 'cs.CL': -2, 'cs.CY': 1 },
  human_ai: { 'cs.AI': 4, 'cs.HC': 3, 'cs.CL': 1, 'cs.RO': 0, 'cs.CY': 2 },
  hri: { 'cs.RO': 5, 'cs.AI': 2, 'cs.HC': 1, 'cs.CL': -2, 'cs.CY': 0 },
  social: { 'cs.CY': 4, 'cs.HC': 3, 'cs.AI': 1, 'cs.CL': 0, 'cs.RO': 0 },
  qa: { 'cs.CL': 4, 'cs.AI': 3, 'cs.LG': 3, 'cs.HC': -1 },
  general: { 'cs.AI': 1, 'cs.CL': 1, 'cs.HC': 1, 'cs.RO': 1, 'cs.CY': 1 },
};

const QA_MISMATCH_SIGNALS = [
  'question answering', 'qa agent', 'qa agents', 'classifier', 'classifiers',
  'tweac', 'extendable qa', 'routing agent', 'transformer with extendable',
];

const HUMAN_INTERACTION_SIGNALS = [
  'human', 'interaction', 'interactions', 'user', 'hci', 'human-computer',
  'human-robot', 'human-ai', 'human-robot interaction', 'social', 'behavioral',
  'collaboration', 'usability', 'interface',
];

// Too vague to use as an arXiv topic alone
const INVALID_TOPICS = new Set([
  'paper', 'papers', 'artigo', 'artigos', 'research', 'study', 'studies',
  'estudo', 'estudos', 'arxiv', 'um', 'uma', 'a',
]);

export function normalizeQuery(query) {
  let q = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  // Unicode-aware equivalent of Python's `[^\w\s\-/]` so accented topics survive.
  q = q.replace(/[^\p{L}\p{N}_\s\-/]/gu, ' ');
  return q.replace(/\s+/g, ' ').trim();
}

export function contentWords(query) {
  return normalizeQuery(query)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w) && w.length > 1);
}

/** Strip filler prefixes left after regex capture. */
function cleanExtractedTopic(topic) {
  let t = String(topic).trim().replace(/[?.!]+$/, '');
  t = t.replace(
    /^(?:um|uma|a|the)\s+(?:paper|papers|artigo|artigos)\s+(?:sobre|about|on)\s+/i,
    ''
  );
  t = t.replace(
    /^(?:paper|papers|artigo|artigos)\s+(?:sobre|about|on|regarding|acerca)\s+/i,
    ''
  );
  return t.trim();
}

export function isValidPaperTopic(topic) {
  if (!topic || String(topic).trim().length < 3) return false;
  const norm = normalizeQuery(topic);
  if (INVALID_TOPICS.has(norm)) return false;
  const words = contentWords(topic);
  if (!words.length) return false;
  if (words.length === 1 && INVALID_TOPICS.has(words[0])) return false;
  return true;
}

const PAPER_TOPIC_PATTERNS = [
  /(?:me\s+)?(?:manda|envia|mande|envie|send)\s+(?:me\s+)?(?:um\s+)?(?:paper|papers|artigo|artigos)\s+(?:sobre|about|on|regarding|acerca)\s+(.+)/i,
  /(?:quero|preciso\s+de)\s+(?:um\s+)?(?:paper|papers|artigo|artigos)\s+(?:sobre|about|on)\s+(.+)/i,
  /(?:paper|papers|artigo|artigos|study|studies|research)\s+(?:sobre|about|on|regarding|acerca)\s+(.+)/i,
  /(?:find|get|search|busca|buscar|give)\s+(?:me\s+)?(?:um\s+)?(?:a\s+)?(?:paper|papers|artigo|artigos)\s+(?:sobre|about|on|regarding)\s+(.+)/i,
  /(?:find|get|search)\s+(?:for\s+)?(?:papers?|articles?|studies)\s+(?:on|about|regarding)\s+(.+)/i,
  /arxiv\s+(?:search\s+)?(?:for\s+)?(.+)/i,
  /(?:research|papers|articles|studies)\s+(?:about|on|that say|that affirm)\s+(.+)/i,
];

const PAPER_TRIGGER_KEYWORDS = [
  'paper', 'papers', 'artigo', 'artigos', 'arxiv',
  'research', 'estudo', 'estudos', 'study', 'studies',
];

/** Extract a research topic from a user message requesting papers. */
export function extractPaperTopic(message) {
  if (!message) return null;
  const text = String(message).trim();
  const lower = text.toLowerCase();

  if (!PAPER_TRIGGER_KEYWORDS.some((kw) => lower.includes(kw))) return null;

  for (const pattern of PAPER_TOPIC_PATTERNS) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      const topic = cleanExtractedTopic(match[1]);
      if (isValidPaperTopic(topic)) return topic;
    }
  }

  return null;
}

/**
 * Best topic for arXiv: prefer extraction from the original user text.
 * Ignores LLM rewrites that collapse to "paper" or other invalid tokens.
 */
export function resolveArxivTopic(userMessage, queryRewrite = '') {
  for (const source of [userMessage, queryRewrite || '']) {
    if (!source) continue;
    const extracted = extractPaperTopic(source);
    if (extracted && isValidPaperTopic(extracted)) return extracted;
  }

  // Full user message may still contain the topic after "sobre/about"
  for (const source of [userMessage, queryRewrite || '']) {
    if (!source) continue;
    const match = String(source).trim().match(/(?:sobre|about|on|regarding|acerca)\s+(.+)$/i);
    if (match?.[1]) {
      const topic = cleanExtractedTopic(match[1]);
      if (isValidPaperTopic(topic)) return topic;
    }
  }

  const fallback = String(queryRewrite || userMessage).trim();
  if (isValidPaperTopic(fallback)) return fallback;
  return String(userMessage).trim();
}

export function detectIntent(query) {
  const q = normalizeQuery(query);
  const has = (terms) => terms.some((t) => q.includes(t));

  if (has(['human-computer', 'human computer', 'hci', 'interaction design', 'cs.hc', 'user interaction'])) {
    return 'hci';
  }
  if (has(['human-ai', 'human ai', 'human-centered ai', 'human centered ai', 'human-ai collaboration', 'human ai collaboration'])) {
    return 'human_ai';
  }
  if (has(['human-robot', 'human robot', 'hri', 'robotics interaction', 'human robot interaction'])) {
    return 'hri';
  }
  if (has(['social interaction', 'behavioral interaction', 'social/behavioral', 'social behavioral'])) {
    return 'social';
  }
  if (has(['question answering', 'qa agent', 'qa agents', 'qa classifier', 'qa routing', 'tweac', 'transformer qa'])) {
    return 'qa';
  }
  return 'general';
}

export function isAmbiguousQuery(query) {
  const q = normalizeQuery(query);
  if (!q) return true;
  if (AMBIGUOUS_PHRASES.has(q)) return true;
  if (/^human\s+interactions?$/.test(q)) return true;

  const words = contentWords(query);
  if (words.length <= 1 && VAGUE_SINGLE_TERMS.has(q)) return true;

  if (words.length <= 2 && detectIntent(query) === 'general') {
    if (AMBIGUOUS_PHRASES.has(q) || ['human interaction', 'human behavior'].some((p) => q.includes(p))) {
      return true;
    }
  }

  return false;
}

/**
 * Build one or more arXiv search strings.
 * @returns {{queries: string[], intent: string, needsClarification: boolean}}
 */
export function buildArxivQueries(userQuery) {
  if (isAmbiguousQuery(userQuery)) {
    return { queries: [], intent: detectIntent(userQuery), needsClarification: true };
  }

  const intent = detectIntent(userQuery);
  const byIntent = {
    hci: ['human-computer interaction', 'HCI user interaction', 'interaction design usability'],
    human_ai: ['human AI interaction', 'human-centered AI', 'human-AI collaboration'],
    hri: ['human robot interaction', 'HRI human-robot interaction', 'robotics social interaction'],
    social: ['social interaction behavioral', 'human social behavior interaction'],
    qa: [userQuery, 'question answering agent classifier', 'QA agent routing transformer'],
  };

  if (byIntent[intent]) {
    return { queries: byIntent[intent], intent, needsClarification: false };
  }

  return { queries: [userQuery, `all:${userQuery}`], intent, needsClarification: false };
}

function importantTerms(query) {
  const terms = contentWords(query);
  const q = normalizeQuery(query);
  const phrases = [
    'human-computer interaction', 'human-computer', 'human-ai',
    'human-robot', 'question answering', 'qa agent',
  ].filter((phrase) => q.includes(phrase));
  return [...terms, ...phrases];
}

const INTENT_PHRASES = {
  hci: ['human-computer interaction', 'human computer interaction', 'hci', 'usability', 'interaction design'],
  human_ai: ['human-ai', 'human ai', 'human-centered', 'human-ai collaboration'],
  hri: ['human-robot', 'human robot', 'hri', 'human-robot interaction'],
  social: ['social interaction', 'behavioral', 'social behavior'],
  qa: ['question answering', 'qa agent', 'classifier', 'routing'],
};

/**
 * @returns {{score: number, why: string}}
 */
export function scorePaperRelevance(paper, userQuery, intent) {
  let score = 0;
  const reasons = [];
  const title = paper.title.toLowerCase();
  const abstract = paper.summary.toLowerCase();
  const combined = `${title} ${abstract}`;
  const queryNorm = normalizeQuery(userQuery);
  const terms = importantTerms(userQuery);

  if (queryNorm && title.includes(queryNorm)) {
    score += 5;
    reasons.push('exact query phrase in title');
  } else if (queryNorm && abstract.includes(queryNorm)) {
    score += 3;
    reasons.push('exact query phrase in abstract');
  }

  for (const term of terms) {
    if (term.length < 3) continue;
    if (title.includes(term)) {
      score += 3;
      reasons.push(`'${term}' in title`);
    } else if (abstract.includes(term)) {
      score += 1;
      reasons.push(`'${term}' in abstract`);
    }
  }

  for (const phrase of INTENT_PHRASES[intent] || []) {
    if (combined.includes(phrase)) {
      score += 4;
      reasons.push(`intent phrase '${phrase}'`);
    }
  }

  const catWeights = INTENT_CATEGORY_PRIORITY[intent] || INTENT_CATEGORY_PRIORITY.general;
  for (const cat of paper.categories) {
    for (const [key, weight] of Object.entries(catWeights)) {
      if (cat === key || cat.startsWith(key)) {
        score += weight;
        if (weight >= 3) reasons.push(`category ${cat}`);
        break;
      }
    }
  }

  if (['hci', 'human_ai', 'hri', 'social'].includes(intent)) {
    const hasHuman = HUMAN_INTERACTION_SIGNALS.some((s) => combined.includes(s));
    const hasQaOnly = QA_MISMATCH_SIGNALS.some((s) => combined.includes(s));
    if (hasQaOnly && !hasHuman) {
      score -= 6;
      reasons.push('penalty: QA/classifier focus without human interaction');
    }
    if (!hasHuman && !combined.includes('interaction') && queryNorm.includes('human')) {
      score -= 4;
      reasons.push('penalty: missing human/interaction in paper');
    }
  }

  if (intent === 'hci' && paper.categories.includes('cs.CL') && !paper.categories.includes('cs.HC')) {
    if (!['human', 'user', 'interface', 'hci', 'interaction'].some((t) => combined.includes(t))) {
      score -= 3;
      reasons.push('penalty: cs.CL without HCI context');
    }
  }

  if (intent === 'qa' && QA_MISMATCH_SIGNALS.some((s) => combined.includes(s))) {
    score += 3;
  }

  const why = reasons.length
    ? reasons.slice(0, 4).join('; ')
    : 'Limited term overlap with query';

  return { score, why };
}

export function wantsRecentPapers(query) {
  const q = normalizeQuery(query);
  return [
    'latest', 'recent', 'current', 'new', 'newest',
    '2024', '2025', '2026', 'last year', 'this year',
  ].some((kw) => q.includes(kw));
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function entryToCandidate(entry) {
  const entryId = String(entry.id || '');
  const authors = asArray(entry.author)
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean)
    .map(String);

  const abstract = String(entry.summary || '').replace(/\s+/g, ' ').trim();
  const published = String(entry.published || '');
  const year = Number(published.slice(0, 4)) || 0;

  const pdfLink = asArray(entry.link).find((l) => l?.['@_title'] === 'pdf');
  const categories = asArray(entry.category)
    .map((c) => c?.['@_term'])
    .filter(Boolean)
    .map(String);

  const arxivId = entryId.includes('/abs/') ? entryId.split('/abs/').pop() : entryId;

  return {
    title: String(entry.title || '').replace(/\s+/g, ' ').trim(),
    authors,
    year,
    url: entryId,
    pdfUrl: pdfLink?.['@_href'] ? String(pdfLink['@_href']) : '',
    summary: abstract.slice(0, 600) + (abstract.length > 600 ? '...' : ''),
    categories,
    arxivId,
    relevanceScore: 0,
    whyItMatches: '',
  };
}

async function fetchOneQuery(query, maxResults) {
  const params = new URLSearchParams({
    search_query: query,
    start: '0',
    max_results: String(maxResults),
    sortBy: 'relevance',
    sortOrder: 'descending',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARXIV_TIMEOUT_MS);

  try {
    const response = await fetch(`${ARXIV_API}?${params}`, {
      headers: { 'User-Agent': 'GrayMatterResearchAgent/3.0 (+https://github.com/sidnei-almeida)' },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const parsed = xmlParser.parse(xml);
    return asArray(parsed?.feed?.entry).map(entryToCandidate);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchArxivCandidates(queries, maxPerQuery = ARXIV_FETCH_MAX) {
  const batches = await Promise.all(queries.map((q) => fetchOneQuery(q, maxPerQuery)));

  const seen = new Set();
  const candidates = [];
  for (const batch of batches) {
    for (const paper of batch) {
      if (!paper.arxivId || seen.has(paper.arxivId)) continue;
      seen.add(paper.arxivId);
      candidates.push(paper);
    }
  }
  return candidates;
}

export function clarificationPayload(message, options) {
  return {
    type: 'clarification',
    message,
    options,
    needsClarification: true,
    papers: [],
  };
}

export function paperResultsPayload(message, papers) {
  return {
    type: 'paper_results',
    message,
    papers,
    needsClarification: false,
  };
}

function filterByYear(candidates, minYear) {
  if (minYear == null) return candidates;
  const filtered = candidates.filter((p) => p.year >= minYear);
  return filtered.length ? filtered : candidates;
}

/**
 * Main pipeline: ambiguity check → query expansion → fetch → score → filter.
 */
export async function searchScientificPapersStructured(userQuery, options = {}) {
  const { maxPapers = null, recentOnly = false } = options;

  const topic = String(userQuery || '').trim();
  let limit = maxPapers || MAX_RETURN_PAPERS;
  if (limit > MAX_RETURN_PAPERS_DEEP) limit = MAX_RETURN_PAPERS_DEEP;

  if (!topic) {
    return clarificationPayload(
      'What topic should I search for on arXiv?',
      CLARIFICATION_OPTIONS_HUMAN_INTERACTION
    );
  }

  const { queries, intent, needsClarification } = buildArxivQueries(topic);

  if (needsClarification) {
    const norm = normalizeQuery(topic);
    if (norm.includes('human') && norm.includes('interaction')) {
      return clarificationPayload(
        CLARIFICATION_MESSAGE_HUMAN_INTERACTION,
        CLARIFICATION_OPTIONS_HUMAN_INTERACTION
      );
    }
    return clarificationPayload(
      `'${topic}' is too broad for a precise arXiv search. ` +
        'Please narrow the topic (e.g., human-computer interaction, human-AI interaction, ' +
        'or a specific disease/mechanism).',
      CLARIFICATION_OPTIONS_HUMAN_INTERACTION
    );
  }

  let candidates = await fetchArxivCandidates(queries);
  const minYear = recentOnly || wantsRecentPapers(topic) ? RECENT_YEAR_CUTOFF : null;
  candidates = filterByYear(candidates, minYear);

  if (!candidates.length) {
    return clarificationPayload(
      `I did not find arXiv results for '${topic}'. ` +
        'Try a more specific phrase or clarify the research area.',
      CLARIFICATION_OPTIONS_HUMAN_INTERACTION
    );
  }

  for (const paper of candidates) {
    const { score, why } = scorePaperRelevance(paper, topic, intent);
    paper.relevanceScore = score;
    paper.whyItMatches = why;
  }

  candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const strong = candidates.filter((p) => p.relevanceScore >= MIN_RELEVANCE_SCORE);

  if (!strong.length) {
    let msg = `I did not find a strong arXiv match for '${topic}'.`;
    if (minYear) msg += ` No strong matches since ${minYear}.`;
    msg += ' Try a more specific phrase or clarify the research area.';
    return clarificationPayload(msg, CLARIFICATION_OPTIONS_HUMAN_INTERACTION);
  }

  const top = strong.slice(0, limit);
  const papersOut = top.map((p) => ({
    title: p.title,
    authors: p.authors.slice(0, 5),
    year: p.year,
    url: p.url,
    pdfUrl: p.pdfUrl,
    summary: p.summary,
    categories: p.categories,
    relevanceScore: p.relevanceScore,
    whyItMatches: p.whyItMatches,
  }));

  const intentLabel = {
    hci: 'human-computer interaction',
    human_ai: 'human-AI interaction',
    hri: 'human-robot interaction',
    social: 'social/behavioral interaction',
    qa: 'question answering / QA agents',
  }[intent] || topic;

  const message =
    intent !== 'general'
      ? `I found ${top.length} paper(s) with strong relevance to ${intentLabel}.`
      : `I found ${top.length} paper(s) matching '${topic}'.`;

  return paperResultsPayload(message, papersOut);
}

/** Format a structured search result as context for the LLM. */
export function formatStructuredResultForAgent(result) {
  if (result?.type === 'clarification') {
    const opts = (result.options || []).map((o) => `  - ${o}`).join('\n');
    return (
      '[ArXiv search — clarification needed]\n' +
      `${result.message}\n\n` +
      `Options:\n${opts}\n\n` +
      'Do not recommend papers until the user clarifies.'
    );
  }

  const lines = [
    `[ArXiv search — ranked results]\n${result?.message || ''}\n`,
    'Only cite papers listed below. Do not add papers not in this list.',
    'Explain relevance using title/abstract only — do not invent matches.\n',
  ];

  (result?.papers || []).forEach((paper, i) => {
    const authors = (paper.authors || []).join(', ').slice(0, 120);
    lines.push(
      `--- Paper ${i + 1} (relevance score: ${paper.relevanceScore ?? 0}) ---\n` +
        `Title: ${paper.title}\n` +
        `Authors: ${authors}\n` +
        `Year: ${paper.year}\n` +
        `URL: ${paper.url}\n` +
        `Categories: ${(paper.categories || []).join(', ')}\n` +
        `Why it matches: ${paper.whyItMatches}\n` +
        `Abstract: ${paper.summary}\n`
    );
  });

  return lines.join('\n');
}
