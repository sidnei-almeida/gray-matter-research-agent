/**
 * Groq chat completions over plain fetch — no SDK, no Python runtime.
 *
 * Targets `openai/gpt-oss-120b`, which supports three things the previous
 * llama-3.3 model did not, and which the agent loop depends on:
 *   - `reasoning_effort` (low | medium | high) mapped from the request depth
 *   - native tool calling, so the model picks and chains its own tools
 *   - strict JSON Schema structured outputs for the intent classifier
 *
 * Two Groq-specific constraints are enforced here rather than at the call sites:
 *   - gpt-oss ignores `reasoning_format`; `include_reasoning` is the supported flag
 *   - `response_format: json_schema` cannot be combined with `tools` in one call
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const LLM_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 45000);
const MAX_RETRIES = Number(process.env.GROQ_MAX_RETRIES || 2);

// gpt-oss is a reasoning model: its model card recommends unmodified sampling.
const DEFAULT_TEMPERATURE = Number(process.env.GROQ_TEMPERATURE ?? 1);
const DEFAULT_TOP_P = Number(process.env.GROQ_TOP_P ?? 1);
const DEFAULT_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS || 2048);

/** Request depth → how hard the model is allowed to think. */
export const REASONING_EFFORT_BY_DEPTH = {
  quick: 'low',
  standard: 'medium',
  deep: 'high',
};

export class MissingApiKeyError extends Error {
  constructor() {
    super('GROQ_API_KEY not found. Set it in your Vercel project environment variables.');
    this.name = 'MissingApiKeyError';
  }
}

export class LlmError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

export function hasApiKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

export function modelInfo() {
  return {
    model: DEFAULT_MODEL,
    provider: 'Groq',
    supports_tool_calling: true,
    supports_structured_outputs: true,
    supports_reasoning_effort: true,
  };
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelayMs(response, attempt) {
  const header = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 8000);
  return Math.min(500 * 2 ** attempt, 4000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postToGroq(body, timeoutMs) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.ok) return await response.json();

      const detail = await response.text().catch(() => '');
      lastError = new LlmError(
        `Groq API ${response.status}: ${detail.slice(0, 300)}`,
        response.status
      );

      if (!isRetryableStatus(response.status) || attempt === MAX_RETRIES) throw lastError;
      await sleep(retryDelayMs(response, attempt));
    } catch (error) {
      if (error instanceof LlmError) {
        if (!isRetryableStatus(error.status) || attempt === MAX_RETRIES) throw error;
        lastError = error;
        await sleep(retryDelayMs(null, attempt));
        continue;
      }

      // Aborts and network errors are worth one more shot.
      lastError = error;
      if (attempt === MAX_RETRIES) throw error;
      await sleep(retryDelayMs(null, attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new LlmError('Groq request failed.');
}

function buildRequestBody(messages, options) {
  const {
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    topP = DEFAULT_TOP_P,
    model = DEFAULT_MODEL,
    reasoningEffort = null,
    includeReasoning = false,
    tools = null,
    toolChoice = null,
    responseFormat = null,
  } = options;

  if (tools?.length && responseFormat) {
    throw new LlmError('Groq rejects `tools` combined with `response_format`; use separate calls.');
  }

  const body = {
    model,
    messages,
    temperature,
    top_p: topP,
    max_completion_tokens: maxTokens,
  };

  if (reasoningEffort) body.reasoning_effort = reasoningEffort;
  if (includeReasoning) body.include_reasoning = true;
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }
  if (responseFormat) body.response_format = responseFormat;

  return body;
}

/**
 * Full completion result, including tool calls — used by the agent loop.
 *
 * @param {Array<object>} messages OpenAI-shaped message list
 * @param {object} options see `buildRequestBody`
 * @returns {Promise<{content: string, reasoning: string, toolCalls: Array, finishReason: string, usage: object, message: object}>}
 */
export async function chatCompleteRaw(messages, options = {}) {
  const body = buildRequestBody(messages, options);
  const data = await postToGroq(body, options.timeoutMs || LLM_TIMEOUT_MS);

  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};

  return {
    content: String(message.content ?? '').trim(),
    reasoning: String(message.reasoning ?? '').trim(),
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    finishReason: choice.finish_reason || '',
    usage: data?.usage || {},
    message,
  };
}

/**
 * Plain text completion.
 *
 * @returns {Promise<string>} assistant message content
 */
export async function chatComplete(messages, options = {}) {
  const { content } = await chatCompleteRaw(messages, options);
  return content;
}

/**
 * Completion constrained to a JSON Schema. Strict mode guarantees the shape,
 * so the caller only has to handle transport failures.
 *
 * @param {Array<object>} messages
 * @param {{name: string, schema: object}} schemaSpec
 * @returns {Promise<object>} parsed object
 */
export async function chatCompleteJson(messages, schemaSpec, options = {}) {
  const content = await chatComplete(messages, {
    temperature: 0,
    ...options,
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: schemaSpec.name,
        strict: true,
        schema: schemaSpec.schema,
      },
    },
  });

  try {
    return JSON.parse(content);
  } catch {
    // Strict mode should make this unreachable; salvage the first object anyway.
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new LlmError('Model did not return parsable JSON.');
    return JSON.parse(match[0]);
  }
}
