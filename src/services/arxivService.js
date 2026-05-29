const ARXIV_API = 'https://export.arxiv.org/api/query';

function parseArxivEntry(entry) {
  const ns = 'http://www.w3.org/2005/Atom';
  const getText = (tag) => entry.getElementsByTagNameNS(ns, tag)[0]?.textContent?.trim() || '';
  const getLinks = () =>
    Array.from(entry.getElementsByTagNameNS(ns, 'link'))
      .map((link) => link.getAttribute('href'))
      .filter(Boolean);

  const id = getText('id');
  const title = getText('title').replace(/\s+/g, ' ');
  const summary = getText('summary').replace(/\s+/g, ' ');
  const published = getText('published');
  const authors = Array.from(entry.getElementsByTagNameNS(ns, 'author')).map(
    (author) => author.getElementsByTagNameNS(ns, 'name')[0]?.textContent?.trim() || ''
  );

  const year = published ? new Date(published).getFullYear() : null;
  const arxivId = id.split('/abs/').pop() || id;

  return {
    id: arxivId,
    title,
    authors,
    year,
    published,
    summary: summary.slice(0, 420) + (summary.length > 420 ? '…' : ''),
    link: id.startsWith('http') ? id : `https://arxiv.org/abs/${arxivId}`,
    links: getLinks(),
    source: 'arxiv',
  };
}

function extractSearchQuery(message) {
  return message
    .replace(/find|search|recent|latest|papers?|articles?|about|on|arxiv|research|show me|get/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchArxiv(message, maxResults = 5) {
  const query = extractSearchQuery(message) || message;
  const url = `${ARXIV_API}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status}`);
  }

  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const entries = Array.from(doc.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'entry'));

  if (entries.length === 0) {
    return {
      content: `No papers found on arXiv for "${query}". Try refining your search terms.`,
      papers: [],
      sources: [],
      toolUsed: 'arxiv',
    };
  }

  const papers = entries.map(parseArxivEntry);
  const content = `Found ${papers.length} recent paper${papers.length > 1 ? 's' : ''} on arXiv for "${query}".`;

  return {
    content,
    papers,
    sources: papers.map((p) => p.link),
    toolUsed: 'arxiv',
  };
}
