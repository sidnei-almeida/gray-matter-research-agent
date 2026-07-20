/** Message formatting and conversation utilities. */

import { FACT_GUARDS, SYSTEM_MESSAGE } from './prompts.js';

export const MAX_HISTORY_MESSAGES = 10;
export const MAX_MESSAGE_CHARS = 4000;

const UI_NOISE_MARKERS = [
  'lab vitals',
  'gray matter labs',
  'welcome to gray matter',
  'suggested prompt',
  'typing...',
  'loading...',
  '__mock__',
  'tool descriptions',
  'sidebar',
  'ui card',
];

export function buildSystemPrompt() {
  return `${SYSTEM_MESSAGE}\n\n${FACT_GUARDS}`;
}

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'user' || r === 'human') return 'user';
  if (r === 'assistant' || r === 'ai' || r === 'agent') return 'assistant';
  return null;
}

function isUiNoise(content) {
  const lower = content.trim().toLowerCase();
  if (!lower) return true;
  if (lower.startsWith('{') && content.length > 500) return true;
  return UI_NOISE_MARKERS.some((marker) => lower.includes(marker));
}

function isSkippableContent(content) {
  const stripped = content.trim();
  if (!stripped) return true;
  const lower = stripped.toLowerCase();
  if (['loading', 'loading...', 'typing...', 'error', 'failed'].includes(lower)) return true;
  if (lower.startsWith('[error') || lower.startsWith('error:')) return true;
  return isUiNoise(stripped);
}

/** Normalize an inbound message to `{role, content}` or null if it should be dropped. */
export function messageToDict(message) {
  if (!message || typeof message !== 'object') return null;

  const role = normalizeRole(message.role);
  const content = String(message.content ?? '').trim();

  if (role === null || isSkippableContent(content)) return null;

  return { role, content: content.slice(0, MAX_MESSAGE_CHARS) };
}

export function dedupeConsecutiveMessages(messages) {
  if (!messages.length) return messages;
  const deduped = [messages[0]];
  for (const message of messages.slice(1)) {
    const prev = deduped[deduped.length - 1];
    if (message.role === prev.role && message.content === prev.content) continue;
    deduped.push(message);
  }
  return deduped;
}

/** Build the final `[system, ...history, user]` array sent to the LLM. */
export function formatMessagesForLlm(systemPrompt, history, userInput) {
  let formattedHistory = (history || [])
    .map(messageToDict)
    .filter(Boolean);

  formattedHistory = dedupeConsecutiveMessages(formattedHistory);
  formattedHistory = formattedHistory.slice(-MAX_HISTORY_MESSAGES);

  const currentInput = String(userInput ?? '').trim().slice(0, MAX_MESSAGE_CHARS);

  const last = formattedHistory[formattedHistory.length - 1];
  if (last && last.role === 'user' && last.content === currentInput) {
    formattedHistory = formattedHistory.slice(0, -1);
  }

  return [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    { role: 'user', content: currentInput },
  ];
}

/** Keep only valid user/assistant turns; drop client system messages and UI noise. */
export function prepareMessages(messages) {
  return (messages || [])
    .filter((m) => normalizeRole(m?.role) !== null)
    .map(messageToDict)
    .filter(Boolean);
}

export function isHeisenbergNameResponse(message) {
  if (!message || !message.trim()) return false;
  const low = message.trim().toLowerCase();
  return (
    /^heisenberg[!.\s]*$/.test(low) ||
    /^it'?s\s+heisenberg[!.\s]*$/.test(low) ||
    /^my name is heisenberg[!.\s]*$/.test(low) ||
    /^say\s+my\s+name\s*:?\s*heisenberg[!.\s]*$/.test(low)
  );
}

/**
 * Split raw inbound messages into prior history and the latest user turn.
 * @returns {{history: Array<{role: string, content: string}>, query: string|null}}
 */
export function extractConversation(rawMessages) {
  const conversation = (rawMessages || []).map(messageToDict).filter(Boolean);

  let lastUser = null;
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    if (conversation[i].role === 'user') {
      lastUser = conversation[i].content;
      break;
    }
  }

  const history = lastUser
    ? conversation.filter((m) => !(m.role === 'user' && m.content === lastUser))
    : conversation;

  return { history, query: lastUser };
}
