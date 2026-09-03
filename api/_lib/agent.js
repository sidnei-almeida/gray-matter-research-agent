/**
 * Research orchestration.
 *
 * Primary path is the agentic loop: gpt-oss picks and chains its own tools.
 * If the loop cannot produce an answer — no API key, Groq outage, empty
 * completion — the deterministic pipeline (classify → plan → tools →
 * synthesize) runs instead, so the API degrades rather than fails.
 */

import { runAgentLoop } from './agentLoop.js';
import {
  computeConfidence,
  markSourcesUsedInAnswer,
  rankEvidence,
} from './evidence.js';
import { hasApiKey } from './llm.js';
import { extractConversation, isHeisenbergNameResponse } from './messages.js';
import { buildResearchPlan } from './planner.js';
import { HEISENBERG_ACK_REPLY } from './prompts.js';
import { classifyIntent, makeIntent } from './router.js';
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

    // Agentic-loop telemetry
    agent_steps: [],
    reasoning_effort: null,
    mode: 'agentic',
    ...fields,
  };
}

/**
 * Label the request from the tools the model actually chose, rather than
 * guessing an intent up front. Keeps the `intent` field honest for the UI.
 */
function deriveIntentFromTrace(state) {
  const used = new Set(state.tools_used);
  const arxiv = used.has('search_scientific_papers');
  const web = used.has('web_search');
  const wiki = used.has('wikipedia');
  const calc = used.has('calculator');

  if (!used.size) return 'general_chat';
  if (calc && used.size === 1) return 'calculation';
  if (arxiv && (web || wiki)) return 'mixed_research';
  if (arxiv) return 'paper_search';
  if (web && wiki) return 'comparative_research';
  if (wiki) return 'concept_explanation';
  if (web) return 'web_research';
  return 'general_chat';
}

/** Repeated arXiv calls can return the same paper twice. */
function dedupePapers(papers) {
  const seen = new Set();
  return papers.filter((paper) => {
    const key = paper.url || paper.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupePlan(plan) {
  const seen = new Set();
  return plan.filter((step) => {
    if (seen.has(step)) return false;
    seen.add(step);
    return true;
  });
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
    agent_steps: state.agent_steps,
    reasoning_effort: state.reasoning_effort,
    mode: state.mode,
  };
}

/** Deterministic fallback: the pre-tool-calling pipeline, unchanged. */
async function runDeterministicPipeline(state) {
  state.mode = 'pipeline';
  state.intent = await classifyIntent(state.user_query, state.depth);

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
  return state;
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
    state.mode = 'easter_egg';
    return state;
  }

  let answered = false;

  if (hasApiKey()) {
    try {
      answered = await runAgentLoop(state);
    } catch (error) {
      console.warn('Agent loop failed, falling back to pipeline:', error.message);
      state.limitations.push('Agentic tool loop unavailable; used the deterministic pipeline.');
    }
  }

  if (answered) {
    state.intent = makeIntent({
      intent: deriveIntentFromTrace(state),
      tools_required: state.tools_used,
      research_depth: state.depth,
      query_rewrite: query,
      reason: 'Derived from the tools the agent chose to run.',
    });
    state.research_plan = dedupePlan(state.research_plan);
    state.papers = dedupePapers(state.papers);
    if (!state.research_plan.length) {
      state.research_plan = ['Answer from conversation context and general knowledge'];
    }
    rankEvidence(state);
  } else {
    // Reset anything a partial loop left behind so the pipeline starts clean.
    state.research_plan = [];
    state.tools_used = [];
    state.evidence = [];
    state.papers = [];
    state.paper_search = null;
    await runDeterministicPipeline(state);
    if (state.intent?.needs_clarification) return state;
  }

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
      agent_steps: [],
      reasoning_effort: null,
      mode: 'idle',
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
