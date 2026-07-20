/**
 * Wikipedia lookup via the REST summary API, with an opensearch fallback
 * when the exact title does not resolve.
 */

const WIKI_SUMMARY_API = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const WIKI_SEARCH_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_TIMEOUT_MS = Number(process.env.WIKIPEDIA_TIMEOUT_MS || 8000);

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'GrayMatterResearchAgent/3.0 (+https://github.com/sidnei-almeida)',
};

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIKI_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Strip leading interrogatives so "what is CRISPR?" resolves to "CRISPR". */
function extractTopic(message) {
  const text = String(message || '').trim();
  const patterns = [
    /(?:what is|what are|explain|define|describe|tell me about|who is|who was)\s+(.+)/i,
    /wikipedia\s+(?:about\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/\?+$/, '');
  }

  return text.replace(/\?+$/, '');
}

async function fetchSummary(title) {
  const slug = encodeURIComponent(title.replace(/\s+/g, '_'));
  const response = await fetchWithTimeout(`${WIKI_SUMMARY_API}/${slug}`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data?.type === 'disambiguation' || !data?.extract) return null;

  return {
    title: data.title,
    summary: String(data.extract),
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
  };
}

async function searchTitle(topic) {
  const params = new URLSearchParams({
    action: 'opensearch',
    search: topic,
    limit: '1',
    format: 'json',
  });
  const response = await fetchWithTimeout(`${WIKI_SEARCH_API}?${params}`);
  if (!response.ok) return null;

  const [, titles] = await response.json();
  return titles?.[0] || null;
}

/**
 * @returns {Promise<{title: string, summary: string, url: string}|null>}
 */
export async function lookupWikipedia(message) {
  const topic = extractTopic(message);
  if (!topic) return null;

  const direct = await fetchSummary(topic);
  if (direct) return direct;

  const suggested = await searchTitle(topic);
  if (suggested && suggested.toLowerCase() !== topic.toLowerCase()) {
    return fetchSummary(suggested);
  }

  return null;
}
