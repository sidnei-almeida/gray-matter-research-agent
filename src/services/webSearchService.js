const DDG_API = 'https://api.duckduckgo.com/';

function extractWebQuery(message) {
  return message
    .replace(/search|find|look up|latest|current|news about|web|online|today|recent/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchWeb(message) {
  const query = extractWebQuery(message) || message;
  const url = `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Web search error: ${response.status}`);
  }

  const data = await response.json();
  const results = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || query,
      snippet: data.AbstractText,
      domain: data.AbstractSource || 'DuckDuckGo',
      link: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      source: 'web',
    });
  }

  if (Array.isArray(data.RelatedTopics)) {
    for (const topic of data.RelatedTopics) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text,
          snippet: topic.Text,
          domain: new URL(topic.FirstURL).hostname,
          link: topic.FirstURL,
          source: 'web',
        });
      } else if (Array.isArray(topic.Topics)) {
        for (const sub of topic.Topics.slice(0, 2)) {
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(' - ')[0] || sub.Text,
              snippet: sub.Text,
              domain: new URL(sub.FirstURL).hostname,
              link: sub.FirstURL,
              source: 'web',
            });
          }
        }
      }
      if (results.length >= 5) break;
    }
  }

  if (results.length === 0) {
    return {
      content: `No instant web results for "${query}". Try the research agent for deeper synthesis.`,
      webResults: [],
      sources: [`https://duckduckgo.com/?q=${encodeURIComponent(query)}`],
      toolUsed: 'web',
    };
  }

  const content = `Live web snapshot for "${query}" — ${results.length} result${results.length > 1 ? 's' : ''} from DuckDuckGo.`;

  return {
    content,
    webResults: results.slice(0, 5),
    sources: results.map((r) => r.link),
    toolUsed: 'web',
  };
}
