import {
  API_BASE_URL,
  CHAT_TIMEOUT_MS,
  fetchWithTimeout,
  formatApiError,
  requestJson,
} from './apiClient';

export async function checkHealth() {
  try {
    const data = await requestJson(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    return { online: true, data };
  } catch (error) {
    return { online: false, error: formatApiError(error) };
  }
}

export async function sendChatMessage(messages) {
  const start = performance.now();

  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      },
      CHAT_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const processingTime = (performance.now() - start) / 1000;

    return {
      content: data.message?.content || data.answer || '',
      toolsUsed: data.tools_used || [],
      processingTime: data.processing_time ?? processingTime,
      structured: data.structured || null,
      sources: data.structured?.sources || [],
      toolUsed: 'agent',
    };
  } catch (error) {
    throw new Error(formatApiError(error));
  }
}

export const AGENT_PERSONA = {
  name: 'Heisenberg Research Agent',
  tagline: 'Advanced Research. Precise Answers.',
  greeting:
    "You're damn right it's pure research. ArXiv, Wikipedia, live web data, and scientific computation — no half measures.",
  subtitle:
    'Autonomous research workspace for scientific articles, encyclopedic knowledge, live web data, and computational reasoning.',
};

export function buildSuggestionsFromResponse(toolUsed) {
  const base = [
    'Compare CRISPR delivery methods for in vivo applications',
    'Find recent papers about AI in healthcare',
    'Explain crystal nucleation and purity',
  ];

  if (toolUsed === 'arxiv') {
    return [...base, 'Summarize latest quantum computing advances'];
  }
  if (toolUsed === 'calculator') {
    return ['Calculate reaction yield from limiting reagent data', 'Compute molar mass of C8H10N4O2'];
  }
  if (toolUsed === 'wikipedia') {
    return ['Explain supersaturated solutions', 'What is CRISPR-Cas9?'];
  }
  if (toolUsed === 'web') {
    return ['Summarize latest quantum computing advances', 'What are current AI regulation updates?'];
  }

  return [
    'Compare CRISPR delivery methods for in vivo applications',
    'Find recent papers about AI in healthcare',
    'Explain crystal nucleation and purity',
    'Calculate reaction yield from limiting reagent data',
    'Summarize latest quantum computing advances',
  ];
}
