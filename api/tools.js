import { sendJson, withApi } from './_lib/http.js';
import { modelInfo } from './_lib/llm.js';

const WEB_PROVIDER = process.env.TAVILY_API_KEY ? 'Tavily' : 'DuckDuckGo';

export default withApi(['GET'], async (req, res) => {
  sendJson(res, 200, {
    model: modelInfo().model,
    calling_convention: 'native function calling',
    tools: [
      {
        name: 'Web Search',
        provider: WEB_PROVIDER,
        description: 'Current web context, docs and news. The agent may call it more than once to refine a query.',
      },
      {
        name: 'Wikipedia',
        provider: 'Wikipedia API',
        description: 'Encyclopedic background.',
      },
      {
        name: 'ArXiv',
        provider: 'ArXiv API',
        description: 'Ranked scientific papers with relevance scoring and match reasoning.',
      },
      {
        name: 'Calculator',
        provider: 'mathjs',
        description: 'Deterministic math evaluation.',
      },
    ],
  });
});
