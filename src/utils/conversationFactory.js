import { createId } from './createId';
import { DEFAULT_CONVERSATION_TITLE } from './generateConversationTitle';

export const WELCOME_MESSAGE = 'Good to see you back. What are we analyzing today?';

export function createWelcomeMessage() {
  return {
    id: createId(),
    role: 'assistant',
    content: WELCOME_MESSAGE,
    timestamp: new Date().toISOString(),
    status: 'sent',
    localOnly: true,
  };
}

export function createEmptyConversation(title = DEFAULT_CONVERSATION_TITLE) {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [createWelcomeMessage()],
  };
}
