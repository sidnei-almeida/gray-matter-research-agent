/** Verify answers against available evidence. */

import { chatComplete } from './llm.js';
import { VERIFIER_REVISION_INSTRUCTION } from './prompts.js';

const RECENCY_CLAIMS = ['latest', 'recent', 'current', 'newest', 'this year', '2024', '2025', '2026'];
const PAPER_CLAIMS = ['paper', 'arxiv', 'study', 'studies', 'research shows', 'according to'];

export function verifyAnswer(state) {
  const issues = [];
  const answer = String(state.answer || '').toLowerCase();

  const evidenceUrls = new Set(
    state.evidence.filter((e) => e.url).map((e) => e.url.toLowerCase())
  );

  // URLs in the answer that are not backed by evidence
  const mentionedUrls = new Set(answer.match(/https?:\/\/[^\s)\]]+/g) || []);
  for (const url of mentionedUrls) {
    const cleaned = url.replace(/[.,;]+$/, '');
    if (!evidenceUrls.has(cleaned) && url.includes('arxiv.org')) {
      issues.push(`Answer cites URL not in evidence: ${url}`);
    }
  }

  // Paper claims without arXiv evidence
  if (PAPER_CLAIMS.some((p) => answer.includes(p))) {
    const hasArxiv = state.evidence.some((e) => e.source_type === 'arxiv');
    if (!hasArxiv && ['paper_search', 'mixed_research'].includes(state.intent?.intent)) {
      issues.push('Answer discusses papers but no arXiv evidence was retrieved.');
    }
  }

  // Recency claims without web/arXiv backing
  if (RECENCY_CLAIMS.some((r) => answer.includes(r))) {
    const hasFresh =
      state.evidence.some((e) => e.source_type === 'web' || e.source_type === 'arxiv') ||
      state.tools_used.includes('search_scientific_papers') ||
      state.tools_used.includes('web_search');
    if (!hasFresh) {
      issues.push('Answer uses recency language without web or arXiv search evidence.');
    }
  }

  state.verification_notes = issues;
  state.verification_passed = issues.length === 0;

  if (issues.length) {
    state.limitations.push(...issues);
    state.answer = addCaution(state.answer, issues);
  }

  return state;
}

function addCaution(answer, issues) {
  if (String(answer).toLowerCase().includes('limitations')) return answer;
  return `${answer}\n\n**Limitations:** ${issues.slice(0, 2).join(' ')}`;
}

export async function reviseIfNeeded(state) {
  if (state.verification_passed || !state.verification_notes.length) return state;

  try {
    const prompt = `Original answer:
${state.answer}

Verification issues:
${state.verification_notes.map((i) => `- ${i}`).join('\n')}

${VERIFIER_REVISION_INSTRUCTION}
`;

    const revised = await chatComplete([
      { role: 'system', content: 'You are a careful scientific editor.' },
      { role: 'user', content: prompt },
    ]);

    if (revised && revised.length > 50) state.answer = revised;
  } catch (error) {
    console.warn('Verifier revision failed:', error.message);
  }

  return state;
}
