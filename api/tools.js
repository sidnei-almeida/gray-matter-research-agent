import { sendJson, withApi } from './_lib/http.js';

const WEB_PROVIDER = process.env.TAVILY_API_KEY ? 'Tavily' : 'DuckDuckGo';

export default withApi(['GET'], async (req, res) => {
  sendJson(res, 200, {
    tools: [
      {
        name: 'Web Search',
        provider: WEB_PROVIDER,
        description: 'Current web context and news.',
      },
      {
        name: 'Wikipedia',
        provider: 'Wikipedia API',
        description: 'Encyclopedic background.',
      },
      {
        name: 'ArXiv',
        provider: 'ArXiv API',
        description: 'Ranked scientific papers with relevance scoring.',
      },
      {
        name: 'Calculator',
        provider: 'mathjs',
        description: 'Deterministic math evaluation.',
      },
    ],
  });
});
