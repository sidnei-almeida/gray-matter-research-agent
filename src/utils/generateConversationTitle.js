export const DEFAULT_CONVERSATION_TITLE = 'New Research Session';

export function generateConversationTitle(text) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return DEFAULT_CONVERSATION_TITLE;
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}
