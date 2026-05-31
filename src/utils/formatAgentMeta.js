const TOOL_LABELS = {
  web_search: 'Web',
  search_scientific_papers: 'ArXiv',
  arxiv: 'ArXiv',
  wikipedia: 'Wikipedia',
  calculator: 'Calculator',
  agent: 'Agent',
  'Research Agent': 'Agent',
};

const INTENT_LABELS = {
  technology_discovery: 'Technology discovery',
  tool_comparison: 'Tool comparison',
  paper_search: 'Paper search',
  web_research: 'Web research',
  concept_explanation: 'Concept explanation',
  mixed_research: 'Mixed research',
  comparative_research: 'Comparative research',
  calculation: 'Calculation',
  general_chat: 'General chat',
};

export function formatToolLabel(tool) {
  if (!tool) return '';
  const key = String(tool).trim();
  return TOOL_LABELS[key] || key.replace(/_/g, ' ');
}

export function formatIntentLabel(intent) {
  if (!intent) return '';
  const key = String(intent).trim();
  return INTENT_LABELS[key] || key.replace(/_/g, ' ');
}

/** Intents where low arXiv match should not trigger a scary low-confidence banner. */
export const WEB_FIRST_INTENTS = new Set([
  'technology_discovery',
  'tool_comparison',
  'web_research',
  'concept_explanation',
]);
