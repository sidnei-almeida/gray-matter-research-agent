/**
 * Research pipeline orchestration:
 * classify → plan → tools → rank → synthesize → verify.
 */

import {
  computeConfidence,
  markSourcesUsedInAnswer,
  rankEvidence,
} from './evidence.js';
import { extractConversation, isHeisenbergNameResponse } from './messages.js';
import { buildResearchPlan } from './planner.js';
import { HEISENBERG_ACK_REPLY } from './prompts.js';
import { classifyIntent } from './router.js';
import { synthesizeAnswer } from './synthesizer.js';
import { executeTools } from './tools.js';
import { reviseIfNeeded, verifyAnswer } from './verifier.js';

const VALID_DEPTHS = ['quick', 'standard', 'deep'];

function makeState(fields) {
  return {
    user_query: '',
    conversation_history: [],
    depth: 'standard',
    max_sources: 8,

    intent: null,
    research_plan: [],
    tools_used: [],
    evidence: [],
    papers: [],
    paper_search: null,

    answer: '',
    confidence: 0.5,
    limitations: [],
    follow_up_questions: [],

    verification_passed: true,
    verification_notes: [],
    ...fields,
  };
}

function suggestFollowUps(state) {
  if (state.intent?.needs_clarification) return [];

  const followUps = [];
  if (state.papers.length) {
    followUps.push('Would you like a deeper summary of any specific paper?');
  }
  if (state.intent?.intent === 'concept_explanation') {
    followUps.push('Would you like recent papers on this topic?');
  }
  if (
    ['mixed_research', 'web_research', 'technology_discovery', 'tool_comparison'].includes(
      state.intent?.intent
    )
  ) {
    followUps.push('Should I search arXiv for peer-reviewed sources?');
  }
  return followUps.slice(0, 3);
}

function toResultDict(state) {
  return {
    answer: state.answer,
    tools_used: state.tools_used,
    intent: state.intent?.intent ?? null,
    research_plan: state.research_plan,
    sources: state.evidence.map((e) => ({
      title: e.title,
      url: e.url,
      source_type: e.source_type,
      snippet: e.snippet,
      relevance_score: e.relevance_score,
      used_in_answer: e.used_in_answer,
      metadata: e.metadata,
    })),
    papers: state.papers,
    confidence: state.confidence,
    limitations: state.limitations,
    follow_up_questions: state.follow_up_questions,
    paper_search: state.paper_search,
  };
}

/**
 * Run the full research pipeline for a single query.
 *
 * @param {string} query
 * @param {{depth?: string, maxSources?: number, conversationHistory?: Array}} options
 */
export async function research(query, options = {}) {
  const { depth = 'standard', maxSources = 8, conversationHistory = [] } = options;
  const { history } = extractConversation(conversationHistory);

  const resolvedDepth = VALID_DEPTHS.includes(depth) ? depth : 'standard';

  const state = makeState({
    user_query: query,
    conversation_history: history,
    depth: resolvedDepth,
    max_sources: resolvedDepth === 'quick' ? 4 : maxSources,
  });

  if (isHeisenbergNameResponse(query)) {
    state.answer = HEISENBERG_ACK_REPLY;
    state.confidence = 1.0;
    return state;
  }

  state.intent = await classifyIntent(query, state.depth);

  if (state.intent.needs_clarification && state.intent.clarification_question) {
    state.answer = state.intent.clarification_question;
    state.confidence = 0.3;
    state.research_plan = ['Clarify ambiguous query before searching'];
    return state;
  }

  state.research_plan = buildResearchPlan(state.intent);
  await executeTools(state);

  // A tool run (e.g. a weak arXiv match) can raise a clarification mid-pipeline.
  if (state.intent.needs_clarification) {
    state.answer = state.intent.clarification_question;
    state.confidence = 0.3;
    return state;
  }

  rankEvidence(state);
  await synthesizeAnswer(state);
  verifyAnswer(state);
  await reviseIfNeeded(state);

  state.confidence = computeConfidence(state);
  markSourcesUsedInAnswer(state, state.answer);
  state.follow_up_questions = suggestFollowUps(state);

  return state;
}

/**
 * Entry point used by the HTTP handlers.
 *
 * @param {{messages?: Array, question?: string, depth?: string, max_sources?: number}} inputs
 */
export async function invokeAgent(inputs = {}) {
  const raw = inputs.messages || [];
  const { history, query } = extractConversation(raw);

  const effectiveQuery = query || String(inputs.question || '').trim();

  if (!effectiveQuery) {
    return {
      answer: 'Ask your question — science, research, or math.',
      tools_used: [],
      intent: null,
      research_plan: [],
      sources: [],
      papers: [],
      confidence: 0.45,
      limitations: [],
      follow_up_questions: [],
      paper_search: null,
    };
  }

  const state = await research(effectiveQuery, {
    depth: inputs.depth || 'standard',
    maxSources: inputs.max_sources ?? 8,
    conversationHistory: raw.length ? raw : [{ role: 'user', content: effectiveQuery }],
  });

  // `research` re-derives history from the raw messages; keep them consistent.
  state.conversation_history = history;

  return toResultDict(state);
}
