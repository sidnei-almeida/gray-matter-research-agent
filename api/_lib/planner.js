/** Research planning step. */

const PLAN_TEMPLATES = {
  concept_explanation: [
    'Identify the core concept',
    'Retrieve encyclopedic background',
    'Synthesize a clear explanation with sources',
  ],
  paper_search: [
    'Identify the research topic',
    'Search arXiv for ranked papers',
    'Summarize findings with paper links',
  ],
  web_research: [
    'Identify the information need',
    'Search the web for current context',
    'Synthesize answer with sources',
  ],
  technology_discovery: [
    'Identify the technology or tooling question',
    'Search the web for current tools and practices',
    'Synthesize answer with web sources (not arXiv-first)',
  ],
  tool_comparison: [
    'Identify tools or platforms to compare',
    'Search the web for comparisons and production guidance',
    'Structure a comparison with evidence from web sources',
  ],
  calculation: [
    'Parse the mathematical expression',
    'Run deterministic calculation',
    'Return the numeric result',
  ],
  comparative_research: [
    'Identify topics to compare',
    'Gather web and literature context',
    'Structure a comparison with evidence',
  ],
  mixed_research: [
    'Identify the scientific topic',
    'Search arXiv for recent papers',
    'Search web for current context',
    'Synthesize answer with sources',
  ],
  general_chat: [
    'Understand the user question',
    'Answer from general knowledge or prior context',
  ],
};

/** Concise operational trace (not chain-of-thought). */
export function buildResearchPlan(intent) {
  const base = [...(PLAN_TEMPLATES[intent.intent] || PLAN_TEMPLATES.general_chat)];
  const required = intent.tools_required || [];

  if (required.includes('arxiv') && !base.join(' ').includes('Search arXiv')) {
    base.splice(base.length - 1, 0, 'Search arXiv for relevant papers');
  }
  if (required.includes('web_search') && !base.join(' ').toLowerCase().includes('web')) {
    base.splice(base.length - 1, 0, 'Search web for current context');
  }
  if (required.includes('wikipedia') && !base.join(' ').includes('Wikipedia')) {
    base.splice(1, 0, 'Search Wikipedia for background');
  }

  return base.slice(0, 5);
}
