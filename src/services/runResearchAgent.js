import { sendChatMessage } from './researchAgent';

export async function runResearchAgent({ query, conversationHistory = [] }) {
  const historyForApi = conversationHistory
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.status === 'sent')
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const result = await sendChatMessage(historyForApi.length ? historyForApi : [{ role: 'user', content: query }]);

    return {
      content: result.content,
      toolUsed: result.toolsUsed?.[0] || result.toolUsed || 'Research Agent',
      sources: result.sources || [],
    };
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 700));

    return {
      content: `I can analyze this research request: "${query}". Next step is connecting the real research tools.`,
      toolUsed: 'Research Agent',
      sources: [],
    };
  }
}
