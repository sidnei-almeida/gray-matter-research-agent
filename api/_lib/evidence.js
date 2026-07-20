/** Evidence ranking and normalization. */

const TOOLING_INTENTS = [
  'technology_discovery',
  'tool_comparison',
  'web_research',
  'concept_explanation',
];

/** Sort evidence by relevance, dedupe by URL/title and cap to max_sources. */
export function rankEvidence(state) {
  const sorted = [...state.evidence].sort((a, b) => b.relevance_score - a.relevance_score);

  const seen = new Set();
  const deduped = [];
  for (const item of sorted) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  state.evidence = deduped.slice(0, state.max_sources);
  return state;
}

export function formatEvidenceForLlm(evidence) {
  if (!evidence.length) return 'No external evidence retrieved.';

  const lines = ['Evidence items (cite ONLY these sources):'];
  evidence.forEach((item, i) => {
    lines.push(`\n[${i + 1}] type=${item.source_type} | score=${item.relevance_score.toFixed(2)}`);
    lines.push(`Title: ${item.title}`);
    if (item.url) lines.push(`URL: ${item.url}`);
    lines.push(`Snippet: ${String(item.snippet).slice(0, 500)}`);
    if (item.metadata?.whyItMatches) {
      lines.push(`Why it matches: ${item.metadata.whyItMatches}`);
    }
  });
  return lines.join('\n');
}

export function computeConfidence(state) {
  if (state.intent?.needs_clarification) return 0.3;

  if (!state.evidence.length) {
    if (state.intent && TOOLING_INTENTS.includes(state.intent.intent)) return 0.4;
    return state.intent?.intent === 'general_chat' ? 0.45 : 0.35;
  }

  const avg =
    state.evidence.reduce((sum, e) => sum + e.relevance_score, 0) / state.evidence.length;
  const toolBonus = Math.min(0.2, state.tools_used.length * 0.05);
  let score = Math.min(0.95, avg * 0.7 + toolBonus + 0.15);

  if (
    state.intent &&
    TOOLING_INTENTS.includes(state.intent.intent) &&
    state.evidence.some((e) => e.source_type === 'web')
  ) {
    score = Math.max(score, 0.55);
  }

  return Math.round(score * 100) / 100;
}

export function markSourcesUsedInAnswer(state, answer) {
  const lower = String(answer || '').toLowerCase();
  for (const item of state.evidence) {
    if (item.url && lower.includes(item.url.toLowerCase())) {
      item.used_in_answer = true;
    } else if (item.title && item.title.length > 10 && lower.includes(item.title.toLowerCase().slice(0, 40))) {
      item.used_in_answer = true;
    }
  }
}
