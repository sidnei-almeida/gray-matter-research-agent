/** Build enriched API responses from agent results. */

/**
 * @param {object} result output of `invokeAgent`
 * @param {string|null} question echoed back for /api/query and /api/research
 */
export function buildEnrichedResponse(result, question = null) {
  const sources = result?.sources || [];
  const papers = result?.papers || [];

  // Legacy structured block for older clients
  const legacySources = sources.map((s) => s.url).filter(Boolean);
  const authors = papers.flatMap((p) => p.authors || []);
  const uniqueAuthors = [...new Set(authors)];

  const payload = {
    answer: result?.answer || 'No response generated.',
    tools_used: result?.tools_used?.length ? result.tools_used : null,
    intent: result?.intent ?? null,
    research_plan: result?.research_plan || [],
    sources,
    papers,
    confidence: result?.confidence ?? 0.5,
    limitations: result?.limitations || [],
    follow_up_questions: result?.follow_up_questions || [],
    structured: {
      sources: legacySources.length ? legacySources.slice(0, 20) : null,
      authors: uniqueAuthors.length ? uniqueAuthors.slice(0, 10) : null,
    },
  };

  if (question !== null) payload.question = question;

  return payload;
}
