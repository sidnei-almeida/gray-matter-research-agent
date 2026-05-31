import { sendChatMessage, sendResearchMessage } from './researchAgent';

function buildApiHistory(conversationHistory = []) {
  return conversationHistory
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        m.status === 'sent' &&
        m.role !== 'system' &&
        !m.localOnly &&
        String(m.content || '').trim()
    )
    .map((m) => ({ role: m.role, content: String(m.content).trim() }));
}

function mapAgentResult(result) {
  return {
    content: result.content,
    toolUsed: result.toolUsed,
    toolsUsed: result.toolsUsed,
    structured: result.structured,
    intent: result.intent,
    researchPlan: result.researchPlan,
    sources: result.sources,
    papers: result.papers,
    confidence: result.confidence,
    confidenceScore: result.confidenceScore,
    limitations: result.limitations,
    followUpQuestions: result.followUpQuestions,
    processingTime: result.processingTime,
    researchDepth: result.researchDepth || null,
    mode: result.mode || 'chat',
  };
}

/**
 * @param {{ query: string, conversationHistory?: array, mode?: 'chat'|'deep', depth?: 'quick'|'standard'|'deep' }} options
 */
export async function runResearchAgent({
  query,
  conversationHistory = [],
  mode = 'chat',
  depth = 'standard',
}) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('Question cannot be empty.');
  }

  if (mode === 'deep') {
    const result = await sendResearchMessage(trimmedQuery, {
      depth: depth === 'quick' || depth === 'standard' ? depth : 'deep',
      maxSources: depth === 'deep' ? 12 : 8,
    });
    return mapAgentResult({ ...result, mode: 'deep' });
  }

  let historyForApi = buildApiHistory(conversationHistory);

  const last = historyForApi[historyForApi.length - 1];
  if (!last || last.role !== 'user' || last.content !== trimmedQuery) {
    historyForApi = [...historyForApi, { role: 'user', content: trimmedQuery }];
  }

  const messages = historyForApi.length
    ? historyForApi
    : [{ role: 'user', content: trimmedQuery }];

  const result = await sendChatMessage(messages);
  return mapAgentResult({ ...result, mode: 'chat' });
}
