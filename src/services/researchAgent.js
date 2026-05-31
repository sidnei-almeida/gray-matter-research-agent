import {
  API_BASE_URL,
  CHAT_TIMEOUT_MS,
  RESEARCH_TIMEOUT_MS,
  fetchWithTimeout,
  formatApiError,
  requestJson,
} from './apiClient';
import { normalizeAgentResponse } from '../utils/agentResponseNormalizer';

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

    return normalizeAgentResponse(data, processingTime);
  } catch (error) {
    throw new Error(formatApiError(error));
  }
}

/**
 * Deep research mode — single question, richer sources (POST /api/research).
 */
export async function sendResearchMessage(question, { depth = 'deep', maxSources = 8 } = {}) {
  const start = performance.now();

  try {
    const data = await requestJson(
      `${API_BASE_URL}/api/research`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          depth,
          max_sources: maxSources,
        }),
      },
      RESEARCH_TIMEOUT_MS
    );

    const processingTime = (performance.now() - start) / 1000;
    const normalized = normalizeAgentResponse(data, processingTime);
    return {
      ...normalized,
      researchDepth: data.depth || depth,
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
