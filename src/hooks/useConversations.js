import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLabDialog } from '../context/LabDialogContext';
import {
  loadActiveConversationId,
  loadConversations,
  saveActiveConversationId,
  saveConversations,
} from '../services/conversationStorage';
import { runResearchAgent } from '../services/runResearchAgent';
import { createId } from '../utils/createId';
import { createEmptyConversation } from '../utils/conversationFactory';
import {
  DEFAULT_CONVERSATION_TITLE,
  generateConversationTitle,
} from '../utils/generateConversationTitle';

function getInitialState() {
  let conversations = loadConversations();
  let activeConversationId = loadActiveConversationId();

  if (conversations.length === 0) {
    const fresh = createEmptyConversation();
    conversations = [fresh];
    activeConversationId = fresh.id;
    saveConversations(conversations);
    saveActiveConversationId(activeConversationId);
  } else if (!activeConversationId || !conversations.some((c) => c.id === activeConversationId)) {
    activeConversationId = conversations[0].id;
  }

  return { conversations, activeConversationId };
}

export function useConversations() {
  const { confirm } = useLabDialog();
  const [state, setState] = useState(getInitialState);
  const [isSending, setIsSending] = useState(false);

  const { conversations, activeConversationId } = state;

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeConversationId) {
      saveActiveConversationId(activeConversationId);
    }
  }, [activeConversationId]);

  const createConversation = useCallback(() => {
    const fresh = createEmptyConversation();
    setState((prev) => ({
      conversations: [fresh, ...prev.conversations],
      activeConversationId: fresh.id,
    }));
    return fresh;
  }, []);

  const selectConversation = useCallback((id) => {
    setState((prev) => {
      if (!prev.conversations.some((c) => c.id === id)) return prev;
      return { ...prev, activeConversationId: id };
    });
  }, []);

  const deleteConversation = useCallback((id) => {
    setState((prev) => {
      const next = prev.conversations.filter((c) => c.id !== id);

      if (next.length === 0) {
        const fresh = createEmptyConversation();
        return { conversations: [fresh], activeConversationId: fresh.id };
      }

      let nextActive = prev.activeConversationId;
      if (id === prev.activeConversationId) {
        nextActive = next[0].id;
      }

      return { conversations: next, activeConversationId: nextActive };
    });
  }, []);

  const renameConversation = useCallback((id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === id ? { ...c, title: trimmed, updatedAt: new Date().toISOString() } : c
      ),
    }));
  }, []);

  const addMessage = useCallback((conversationId, message) => {
    const now = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              updatedAt: now,
              messages: [...c.messages, message],
            }
          : c
      ),
    }));
  }, []);

  const updateMessage = useCallback((conversationId, messageId, updates) => {
    const now = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              updatedAt: now,
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
            }
          : c
      ),
    }));
  }, []);

  const maybeAutoTitle = useCallback((conversationId, userText) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        if (c.title !== DEFAULT_CONVERSATION_TITLE) return c;
        return {
          ...c,
          title: generateConversationTitle(userText),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  }, []);

  const sendMessage = useCallback(
    async (content) => {
      const trimmed = content.trim();
      if (!trimmed || !activeConversationId || isSending) return;

      const conv = conversations.find((c) => c.id === activeConversationId);
      if (!conv) return;

      setIsSending(true);
      maybeAutoTitle(activeConversationId, trimmed);

      const userMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
        status: 'sent',
      };

      addMessage(activeConversationId, userMessage);

      const assistantId = createId();

      addMessage(activeConversationId, {
        id: assistantId,
        role: 'assistant',
        content: 'Running research protocol…',
        timestamp: new Date().toISOString(),
        status: 'loading',
      });

      const history = [...conv.messages, userMessage];

      try {
        const response = await runResearchAgent({
          query: trimmed,
          conversationHistory: history.slice(-8),
        });

        updateMessage(activeConversationId, assistantId, {
          content: response.content,
          status: 'sent',
          toolUsed: response.toolUsed,
          sources: response.sources || [],
          timestamp: new Date().toISOString(),
        });
      } catch {
        updateMessage(activeConversationId, assistantId, {
          content: 'The lab hit an error while processing this request.',
          status: 'error',
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsSending(false);
      }
    },
    [activeConversationId, conversations, isSending, addMessage, updateMessage, maybeAutoTitle]
  );

  const handleDeleteConversation = useCallback(
    async (id) => {
      const conv = conversations.find((c) => c.id === id);
      const sessionLabel = conv?.title ? `"${conv.title}"` : 'this research session';

      const confirmed = await confirm({
        variant: 'danger',
        title: 'Discard research session?',
        description: `${sessionLabel} and all messages in this lab notebook will be removed from local storage. This cannot be undone.`,
        cancelLabel: 'Keep in lab',
        confirmLabel: 'Discard session',
      });

      if (confirmed) deleteConversation(id);
    },
    [confirm, conversations, deleteConversation]
  );

  return {
    conversations,
    activeConversation,
    activeConversationId,
    createConversation,
    selectConversation,
    deleteConversation: handleDeleteConversation,
    renameConversation,
    addMessage,
    updateMessage,
    sendMessage,
    isSending,
  };
}
