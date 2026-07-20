/**
 * Web search with graceful provider fallback.
 *
 * 1. Tavily      — used when TAVILY_API_KEY is set (best quality for tooling questions)
 * 2. DuckDuckGo HTML endpoint — no key, scraped; may be rate-limited from cloud IPs
 * 3. DuckDuckGo Instant Answer API — no key, thin but very reliable
 *
 * Every provider returns the same shape: `{title, url, snippet}[]`.
 */

const SEARCH_TIMEOUT_MS = Number(process.env.WEB_SEARCH_TIMEOUT_MS || 10000);
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
};

function stripHtml(input) {
  return String(input || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** html.duckduckgo.com wraps outbound links in /l/?uddg=<encoded>. */
function unwrapDdgLink(href) {
  try {
    const url = new URL(href.startsWith('//') ? `https:${href}` : href, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : url.toString();
  } catch {
    return href;
  }
}

async function searchTavily(query, maxResults) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();

  return (data?.results || [])
    .map((r) => ({
      title: String(r.title || '').trim(),
      url: String(r.url || '').trim(),
      snippet: String(r.content || '').trim(),
    }))
    .filter((r) => r.url);
}

async function searchDuckDuckGoHtml(query, maxResults) {
  const response = await fetchWithTimeout('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': BROWSER_UA,
      Accept: 'text/html',
    },
    body: new URLSearchParams({ q: query }).toString(),
  });

  if (!response.ok) return null;
  const html = await response.text();

  const results = [];
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const snippets = [];
  let snippetMatch;
  while ((snippetMatch = snippetRe.exec(html)) !== null) {
    snippets.push(stripHtml(snippetMatch[1]));
  }

  let linkMatch;
  let i = 0;
  while ((linkMatch = linkRe.exec(html)) !== null && results.length < maxResults) {
    const url = unwrapDdgLink(linkMatch[1]);
    const title = stripHtml(linkMatch[2]);
    if (url && title) {
      results.push({ title, url, snippet: snippets[i] || '' });
    }
    i += 1;
  }

  return results.length ? results : null;
}

async function searchDuckDuckGoInstant(query, maxResults) {
  const url =
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
    '&format=json&no_redirect=1&no_html=1';

  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;

  const data = await response.json();
  const results = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: data.AbstractText,
    });
  }

  const pushTopic = (topic) => {
    if (results.length >= maxResults) return;
    if (topic?.Text && topic?.FirstURL) {
      results.push({
        title: topic.Text.split(' - ')[0] || topic.Text,
        url: topic.FirstURL,
        snippet: topic.Text,
      });
    }
  };

  for (const topic of data.RelatedTopics || []) {
    if (Array.isArray(topic?.Topics)) {
      topic.Topics.slice(0, 2).forEach(pushTopic);
    } else {
      pushTopic(topic);
    }
    if (results.length >= maxResults) break;
  }

  return results.length ? results : null;
}

/**
 * Runs providers in order and returns the first non-empty result set.
 * @returns {Promise<{results: Array<{title,url,snippet}>, provider: string}>}
 */
export async function searchWeb(query, maxResults = 5) {
  const providers = [
    ['tavily', searchTavily],
    ['duckduckgo-html', searchDuckDuckGoHtml],
    ['duckduckgo-instant', searchDuckDuckGoInstant],
  ];

  for (const [name, provider] of providers) {
    try {
      const results = await provider(query, maxResults);
      if (results?.length) {
        return { results: results.slice(0, maxResults), provider: name };
      }
    } catch (error) {
      console.warn(`Web search provider ${name} failed:`, error.message);
    }
  }

  return { results: [], provider: 'none' };
}
