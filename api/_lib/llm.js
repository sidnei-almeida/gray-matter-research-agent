/**
 * Groq chat completions over plain fetch — no SDK, no Python runtime.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const LLM_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 45000);

export class MissingApiKeyError extends Error {
  constructor() {
    super('GROQ_API_KEY not found. Set it in your Vercel project environment variables.');
    this.name = 'MissingApiKeyError';
  }
}

export function hasApiKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {{temperature?: number, maxTokens?: number, topP?: number, model?: string}} options
 * @returns {Promise<string>} assistant message content
 */
export async function chatComplete(messages, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  const {
    temperature = 0.2,
    maxTokens = 1024,
    topP = 0.9,
    model = DEFAULT_MODEL,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Groq API ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}
