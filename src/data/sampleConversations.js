export const SAMPLE_SUGGESTIONS = [
  'Compare CRISPR delivery methods for in vivo applications',
  'Find recent papers about AI in healthcare',
  'Explain crystal nucleation and purity',
  'Calculate reaction yield from limiting reagent data',
  'Summarize latest quantum computing advances',
];

export const sampleConversations = [
  {
    id: 'sample-1',
    title: 'Quantum computing advances',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'What are the latest advances in quantum computing?',
        timestamp: Date.now() - 3600000,
      },
      {
        id: 'm2',
        role: 'assistant',
        content:
          'Recent quantum computing research focuses on error correction, neutral-atom arrays, and hybrid classical-quantum workflows. Check arXiv for the newest preprints on fault-tolerant qubit architectures.',
        timestamp: Date.now() - 3590000,
        toolUsed: 'agent',
        sources: ['https://arxiv.org/list/quant-ph/recent'],
        suggestions: SAMPLE_SUGGESTIONS.slice(0, 3),
      },
    ],
  },
];
