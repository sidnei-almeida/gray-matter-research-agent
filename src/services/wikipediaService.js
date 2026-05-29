const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary';

function extractTopic(message) {
  const patterns = [
    /(?:what is|what are|explain|define|describe|tell me about|who is|who was)\s+(.+)/i,
    /wikipedia\s+(?:about\s+)?(.+)/i,
    /^(.+?)\?*$/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\?+$/, '');
    }
  }

  return message.trim();
}

function titleToSlug(title) {
  return encodeURIComponent(title.replace(/\s+/g, '_'));
}

export async function searchWikipedia(message) {
  const topic = extractTopic(message);
  const slug = titleToSlug(topic);
  const url = `${WIKI_API}/${slug}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const [, titles, descriptions, links] = await searchRes.json();

    if (titles?.length) {
      return searchWikipedia(titles[0]);
    }

    return {
      content: `No Wikipedia article found for "${topic}". Try a more specific term.`,
      wiki: null,
      sources: [],
      toolUsed: 'wikipedia',
    };
  }

  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }

  const data = await response.json();

  const wiki = {
    title: data.title,
    summary: data.extract,
    link: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
    thumbnail: data.thumbnail?.source,
    source: 'wikipedia',
  };

  return {
    content: wiki.summary,
    wiki,
    sources: [wiki.link],
    toolUsed: 'wikipedia',
  };
}
