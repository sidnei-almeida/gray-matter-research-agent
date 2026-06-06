import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import AgentIntro from './AgentIntro';
import MessageBubble from './MessageBubble';
import { formatMessageTime } from '../utils/formatMessageTime';

function getScrollSignature(messages = []) {
  const last = messages[messages.length - 1];
  if (!last) return 'empty';

  return [
    last.id,
    last.status,
    last.content?.length ?? 0,
    last.papers?.length ?? 0,
    last.sources?.length ?? 0,
  ].join(':');
}

export default function MessageList({ conversation, onFollowUpSelect }) {
  const listRef = useRef(null);
  const scrollSignature = useMemo(
    () => getScrollSignature(conversation?.messages),
    [conversation?.messages]
  );

  const scrollToBottom = (behavior = 'auto') => {
    const el = listRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  };

  useLayoutEffect(() => {
    if (!conversation) return;
    scrollToBottom('auto');
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.messages?.length) return;

    scrollToBottom('smooth');

    const frame = requestAnimationFrame(() => {
      scrollToBottom('auto');
    });

    return () => cancelAnimationFrame(frame);
  }, [conversation?.id, conversation?.messages?.length, scrollSignature]);

  if (!conversation) {
    return (
      <div className="message-list">
        <p className="message-list-empty">Start a new research session.</p>
      </div>
    );
  }

  return (
    <div className="message-list" ref={listRef}>
      <div className="agent-conversation-start">
        <AgentIntro />
        <div className="messages-thread messages-thread--intro">
          {conversation.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={formatMessageTime(msg.timestamp)}
              toolUsed={msg.toolUsed}
              toolsUsed={msg.toolsUsed}
              sources={msg.sources}
              papers={msg.papers}
              intent={msg.intent}
              researchPlan={msg.researchPlan}
              confidence={msg.confidence}
              confidenceScore={msg.confidenceScore}
              limitations={msg.limitations}
              followUpQuestions={msg.followUpQuestions}
              processingTime={msg.processingTime}
              researchMode={msg.researchMode}
              status={msg.status}
              showAvatar={msg.role === 'user'}
              onFollowUpSelect={onFollowUpSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
