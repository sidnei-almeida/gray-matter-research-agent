/** Answer synthesis from ranked evidence. */

import { formatEvidenceForLlm } from './evidence.js';
import { chatComplete } from './llm.js';
import { buildSystemPrompt, formatMessagesForLlm } from './messages.js';
import { SYNTHESIS_INSTRUCTION } from './prompts.js';

export async function synthesizeAnswer(state) {
  if (state.intent?.needs_clarification) {
    state.answer = state.intent.clarification_question;
    state.confidence = 0.3;
    state.limitations.push('Query needs clarification before research can proceed.');
    return state;
  }

  const evidenceText = formatEvidenceForLlm(state.evidence);
  const planText = state.research_plan.map((step) => `- ${step}`).join('\n');

  const synthesisPrompt = `User question: ${state.user_query}

Research plan executed:
${planText}

${evidenceText}

${SYNTHESIS_INSTRUCTION}
`;

  const context = formatMessagesForLlm(
    buildSystemPrompt(),
    state.conversation_history,
    synthesisPrompt
  );

  try {
    state.answer = await chatComplete(context);
    if (!state.answer) {
      state.answer = fallbackAnswer(state);
      state.limitations.push('LLM returned an empty answer; showing evidence summary.');
    }
  } catch (error) {
    console.warn('Synthesis failed:', error.message);
    state.answer = fallbackAnswer(state);
    state.limitations.push('LLM synthesis unavailable; showing evidence summary.');
  }

  return state;
}

function fallbackAnswer(state) {
  if (state.papers.length) {
    const lines = [state.paper_search?.message || 'Ranked arXiv results:', ''];
    state.papers.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.title} (${p.year ?? '?'})`);
      lines.push(`   URL: ${p.url}`);
      lines.push(`   ${p.whyItMatches || ''}`);
    });
    lines.push('\n(LLM synthesis unavailable.)');
    return lines.join('\n');
  }

  if (state.evidence.length) {
    const lines = ['Evidence summary (LLM unavailable):', ''];
    state.evidence.forEach((e, i) => {
      lines.push(`${i + 1}. [${e.source_type}] ${e.title}`);
      if (e.url) lines.push(`   ${e.url}`);
      lines.push(`   ${String(e.snippet).slice(0, 300)}`);
    });
    return lines.join('\n');
  }

  return (
    'Unable to generate a full answer right now. ' +
    'Please retry with a clearer scientific question.'
  );
}
