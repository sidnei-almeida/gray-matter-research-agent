/**
 * Agentic research loop built on gpt-oss native tool calling.
 *
 * The model decides which tools to run, reads the results, and may search
 * again with a refined query before answering — so multi-hop questions work
 * without the keyword routing tables the old fixed pipeline depended on.
 * Evidence is collected out-of-band as tools execute, which keeps citations
 * verifiable instead of trusting whatever URLs end up in the prose.
 */

import { chatCompleteRaw, REASONING_EFFORT_BY_DEPTH } from './llm.js';
import { buildSystemPrompt, formatMessagesForLlm } from './messages.js';
import { LOOP_INSTRUCTION } from './prompts.js';
import {
  describeToolCall,
  executeToolCall,
  TOOL_DEFINITIONS,
  TOOL_USED_LABELS,
} from './toolSchemas.js';

/** Per-depth budget. Steps are model turns; tool calls are capped separately. */
const BUDGETS = {
  quick: { maxSteps: 2, maxToolCalls: 3, maxTokens: 1600 },
  standard: { maxSteps: 4, maxToolCalls: 6, maxTokens: 2400 },
  deep: { maxSteps: 6, maxToolCalls: 10, maxTokens: 3600 },
};

const MAX_TOOL_RESULT_CHARS = 4000;

function parseToolArguments(rawArguments) {
  if (!rawArguments) return {};
  if (typeof rawArguments === 'object') return rawArguments;
  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}

/**
 * Assistant turns must be replayed with their tool_calls intact. The `reasoning`
 * field is deliberately dropped — Groq's tool-use contract is role, content,
 * tool_calls, and echoing extra fields back is not part of it.
 */
function toAssistantMessage(message) {
  const assistant = { role: 'assistant', content: message.content ?? '' };
  if (message.tool_calls?.length) assistant.tool_calls = message.tool_calls;
  return assistant;
}

/** Every tool_call id in an assistant turn needs a matching tool reply. */
function toToolMessage(call, name, content) {
  return {
    role: 'tool',
    tool_call_id: call.id,
    name,
    content: String(content || '').slice(0, MAX_TOOL_RESULT_CHARS),
  };
}

function recordToolUse(state, label) {
  if (label && !state.tools_used.includes(label)) state.tools_used.push(label);
}

async function runOneToolCall(call, state, seen) {
  const name = call.function?.name || '';
  const args = parseToolArguments(call.function?.arguments);
  const signature = `${name}:${JSON.stringify(args)}`;

  if (seen.has(signature)) {
    return {
      call,
      name,
      args,
      content: `Skipped: ${name} was already called with these arguments. Use the earlier result or refine the query.`,
      evidence: [],
      skipped: true,
    };
  }
  seen.add(signature);

  try {
    const result = await executeToolCall(name, args, state);
    return { call, name, args, ...result };
  } catch (error) {
    console.warn(`Tool ${name} failed:`, error.message);
    state.limitations.push(`${name} failed: ${error.message}`);
    return { call, name, args, content: `${name} failed: ${error.message}`, evidence: [] };
  }
}

function applyToolResult(state, result) {
  if (result.skipped) return;

  recordToolUse(state, TOOL_USED_LABELS[result.name]);
  state.research_plan.push(describeToolCall(result.name, result.args));

  if (result.evidence?.length) state.evidence.push(...result.evidence);
  if (result.papers?.length) state.papers = [...state.papers, ...result.papers];
  if (result.paperSearch) state.paper_search = result.paperSearch;

  state.agent_steps.push({
    tool: result.name,
    arguments: result.args,
    evidence_count: result.evidence?.length || 0,
  });
}

/**
 * Run the loop until the model produces a final answer or the budget runs out.
 *
 * Mutates `state` (answer, evidence, papers, tools_used, research_plan, agent_steps).
 *
 * @returns {Promise<boolean>} true when the model produced an answer
 */
export async function runAgentLoop(state) {
  const budget = BUDGETS[state.depth] || BUDGETS.standard;
  const reasoningEffort = REASONING_EFFORT_BY_DEPTH[state.depth] || 'medium';

  const messages = formatMessagesForLlm(
    `${buildSystemPrompt()}\n\n${LOOP_INSTRUCTION}`,
    state.conversation_history,
    state.user_query
  );

  const seenToolCalls = new Set();
  let toolCallsMade = 0;

  for (let step = 0; step < budget.maxSteps; step += 1) {
    const budgetExhausted = toolCallsMade >= budget.maxToolCalls;
    const lastStep = step === budget.maxSteps - 1;
    const allowTools = !budgetExhausted && !lastStep;

    // With `tools` omitted the model physically cannot call anything, but saying
    // so in the last tool result stops it from stalling for a call that can't come.
    const lastMessage = messages[messages.length - 1];
    if (!allowTools && toolCallsMade > 0 && lastMessage?.role === 'tool') {
      lastMessage.content +=
        '\n\n(Tool budget reached. Write the final answer from the evidence already gathered.)';
    }

    const response = await chatCompleteRaw(messages, {
      tools: allowTools ? TOOL_DEFINITIONS : null,
      toolChoice: allowTools ? 'auto' : undefined,
      reasoningEffort,
      maxTokens: budget.maxTokens,
    });

    if (!response.toolCalls.length) {
      if (response.content) {
        state.answer = response.content;
        state.reasoning_effort = reasoningEffort;
        return true;
      }
      // No content and no tool calls: nothing more to extract from this turn.
      break;
    }

    messages.push(toAssistantMessage(response.message));

    const calls = response.toolCalls.slice(0, budget.maxToolCalls - toolCallsMade);
    const results = await Promise.all(
      calls.map((call) => runOneToolCall(call, state, seenToolCalls))
    );

    for (const result of results) {
      applyToolResult(state, result);
      messages.push(toToolMessage(result.call, result.name, result.content));
    }

    toolCallsMade += calls.length;

    // The model asked for more calls than the budget allows — drop the rest,
    // but every tool_call id in the assistant turn still needs a reply.
    for (const call of response.toolCalls.slice(calls.length)) {
      messages.push(
        toToolMessage(
          call,
          call.function?.name || 'unknown',
          'Skipped: tool budget exhausted for this request.'
        )
      );
    }
  }

  state.reasoning_effort = reasoningEffort;
  return false;
}
