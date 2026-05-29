export const agentIntro = {
  name: 'Heisenberg',
  role: 'Research Agent',
  quote: 'Say my name… Then tell me what we\'re analyzing in the lab.',
};

export const labTools = [
  {
    id: 'arxiv',
    title: 'ArXiv',
    description: 'Search preprints and academic papers',
    status: 'Ready',
  },
  {
    id: 'wikipedia',
    title: 'Wikipedia',
    description: 'Quick knowledge lookups',
    status: 'Ready',
  },
  {
    id: 'web',
    title: 'Live Web',
    description: 'Real-time information from the web',
    status: 'Ready',
  },
  {
    id: 'calc',
    title: 'Scientific Calculations',
    description: 'Compute, analyze, and visualize data',
    status: 'Ready',
  },
];

export const labVitals = [
  { label: 'Computational Power', value: '87%', progress: 87 },
  { label: 'Data Sources Active', value: '128', progress: 65 },
  { label: 'Models Loaded', value: '12', progress: 75 },
  { label: 'Lab Status', value: 'Optimal', isStatus: true },
];

export const periodicElements = [
  { number: 27, symbol: 'Co', name: 'Cobalt' },
  { number: 58, symbol: 'Ce', name: 'Cerium' },
  { number: 14, symbol: 'Si', name: 'Silicon' },
  { number: 15, symbol: 'P', name: 'Phosphorus' },
  { number: 16, symbol: 'S', name: 'Sulfur' },
];

export const suggestedPrompts = [
  'Latest quantum computing advances',
  'Explain crystal nucleation and purity',
  'Find recent papers about AI in healthcare',
  'Compare CRISPR delivery methods for in vivo applications',
  'Calculate reaction yield from limiting reagent data',
  'Summarize breakthroughs in solid-state batteries',
];

export const chatStatusBadges = [
  { id: 'arxiv', label: 'ArXiv ready' },
  { id: 'web', label: 'Web ready' },
  { id: 'calc', label: 'Calculator ready' },
];

export const composerShortcuts = [
  { id: 'arxiv', label: 'arXiv' },
  { id: 'web', label: 'Web' },
  { id: 'wiki', label: 'Wiki' },
  { id: 'calc', label: 'Calc' },
];

export const MAX_INPUT_LENGTH = 2000;
