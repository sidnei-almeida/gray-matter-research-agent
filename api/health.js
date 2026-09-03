import { hasApiKey, modelInfo } from './_lib/llm.js';
import { sendJson, withApi } from './_lib/http.js';

export default withApi(['GET'], async (req, res) => {
  const ready = hasApiKey();
  const info = modelInfo();

  sendJson(res, 200, {
    status: ready ? 'healthy' : 'unhealthy: GROQ_API_KEY is not configured',
    agent_initialized: ready,
    available_tools: ready ? ['Web Search', 'Wikipedia', 'ArXiv', 'Calculator'] : [],
    model: info.model,
    provider: info.provider,
    agent_mode: ready ? 'agentic-tool-calling' : 'unavailable',
    web_provider: process.env.TAVILY_API_KEY ? 'Tavily' : 'DuckDuckGo',
    version: '4.0.0',
    runtime: 'nodejs',
  });
});
