function asStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function normalizeSource(source, index = 0) {
  if (typeof source === 'string' && source.trim()) {
    const url = source.trim();
    return {
      id: url,
      url,
      title: url,
      sourceType: null,
      snippet: null,
      relevanceScore: null,
      usedInAnswer: null,
    };
  }

  if (!source || typeof source !== 'object') return null;

  const url = (source.url || source.link || '').trim();
  const title = (source.title || url || `Source ${index + 1}`).trim();
  const snippet = source.snippet || null;

  if (!url && !snippet && !title) return null;

  return {
    id: url || source.id || `source-${index}`,
    url: url || null,
    title,
    sourceType: source.source_type || source.sourceType || null,
    snippet,
    relevanceScore: source.relevance_score ?? source.relevanceScore ?? null,
    usedInAnswer: source.used_in_answer ?? source.usedInAnswer ?? null,
  };
}

export function normalizePaper(paper, index = 0) {
  if (!paper || typeof paper !== 'object') return null;

  const title = paper.title?.trim();
  if (!title) return null;

  const authors = Array.isArray(paper.authors)
    ? paper.authors.filter(Boolean).map(String)
    : paper.authors
      ? [String(paper.authors)]
      : [];

  return {
    id: paper.url || paper.pdf_url || paper.pdfUrl || `paper-${index}`,
    title,
    authors,
    year: paper.year ?? null,
    abstract: paper.abstract || paper.summary || null,
    url: paper.url || null,
    pdfUrl: paper.pdf_url || paper.pdfUrl || null,
    categories: Array.isArray(paper.categories) ? paper.categories.filter(Boolean).map(String) : [],
    relevanceScore: paper.relevance_score ?? paper.relevanceScore ?? null,
    whyItMatches: paper.why_it_matches || paper.whyItMatches || null,
  };
}

export function normalizeSourcesList(rawSources) {
  if (!rawSources) return [];

  const list = Array.isArray(rawSources) ? rawSources : [rawSources];
  const seen = new Set();
  const normalized = [];

  list.forEach((item, index) => {
    const source = normalizeSource(item, index);
    if (!source) return;
    const key = source.url || source.id;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(source);
  });

  return normalized;
}

export function normalizePapersList(rawPapers) {
  if (!rawPapers || !Array.isArray(rawPapers)) return [];

  return rawPapers
    .map((paper, index) => normalizePaper(paper, index))
    .filter(Boolean);
}

export function normalizeResearchPlan(plan) {
  if (!plan) return [];

  if (typeof plan === 'string' && plan.trim()) {
    return [{ index: 1, step: plan.trim(), tool: null }];
  }

  if (!Array.isArray(plan)) return [];

  return plan
    .map((item, index) => {
      if (typeof item === 'string' && item.trim()) {
        return { index: index + 1, step: item.trim(), tool: null };
      }

      if (!item || typeof item !== 'object') return null;

      const step =
        item.step ||
        item.description ||
        item.action ||
        item.query ||
        item.text ||
        '';

      if (!String(step).trim()) return null;

      return {
        index: index + 1,
        step: String(step).trim(),
        tool: item.tool || item.tool_name || item.source || null,
      };
    })
    .filter(Boolean);
}

export function normalizeConfidenceScore(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isLowConfidence(confidence, confidenceScore, intent = null) {
  const score =
    normalizeConfidenceScore(confidenceScore) ??
    normalizeConfidenceScore(confidence);

  if (score != null && score >= 0.45) return false;

  if (
    intent &&
    ['technology_discovery', 'tool_comparison', 'web_research', 'concept_explanation'].includes(
      intent
    ) &&
    score != null &&
    score >= 0.35
  ) {
    return false;
  }

  if (score != null && score < 0.4) return true;

  const label = String(confidence || '').toLowerCase();
  return label === 'low' || label === 'clarification' || label === 'uncertain';
}

export function normalizeAgentResponse(data, processingTime = 0) {
  const structured = data?.structured && typeof data.structured === 'object' ? data.structured : null;

  const content =
    data?.answer ||
    data?.message?.content ||
    structured?.answer ||
    '';

  const toolsUsed = Array.isArray(data?.tools_used)
    ? data.tools_used.filter(Boolean).map(String)
    : data?.tools_used
      ? [String(data.tools_used)]
      : [];

  const sources = normalizeSourcesList([
    ...(Array.isArray(data?.sources) ? data.sources : []),
    ...(Array.isArray(structured?.sources) ? structured.sources : []),
  ]);

  const papers = normalizePapersList(data?.papers || structured?.papers);

  const rawConfidence = data?.confidence ?? structured?.confidence ?? null;
  let confidenceScore =
    normalizeConfidenceScore(
      data?.confidence_score ?? data?.confidenceScore ?? structured?.confidence_score
    ) ?? null;

  if (confidenceScore == null && typeof rawConfidence === 'number') {
    confidenceScore = rawConfidence;
  }

  const confidence =
    rawConfidence != null && typeof rawConfidence !== 'number'
      ? String(rawConfidence)
      : confidenceScore != null
        ? `${Math.round(confidenceScore * 100)}%`
        : null;

  return {
    content: String(content || '').trim(),
    toolsUsed,
    toolUsed: toolsUsed[0] || 'Research Agent',
    structured,
    intent: data?.intent ?? structured?.intent ?? null,
    researchPlan: normalizeResearchPlan(data?.research_plan ?? structured?.research_plan),
    sources,
    papers,
    confidence,
    confidenceScore,
    limitations: asStringArray(data?.limitations ?? structured?.limitations),
    followUpQuestions: asStringArray(
      data?.follow_up_questions ?? data?.followUpQuestions ?? structured?.follow_up_questions
    ),
    processingTime: data?.processing_time ?? processingTime,
  };
}
