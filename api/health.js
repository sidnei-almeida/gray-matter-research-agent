import { hasApiKey } from './_lib/llm.js';
import { sendJson, withApi } from './_lib/http.js';

export default withApi(['GET'], async (req, res) => {
  const ready = hasApiKey();

  sendJson(res, 200, {
    status: ready ? 'healthy' : 'unhealthy: GROQ_API_KEY is not configured',
    agent_initialized: ready,
    available_tools: ready ? ['Web Search', 'Wikipedia', 'ArXiv', 'Calculator'] : [],
    version: '3.0.0',
    runtime: 'nodejs',
  });
});
