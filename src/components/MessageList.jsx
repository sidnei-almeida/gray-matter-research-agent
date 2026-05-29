import AgentIntro from './AgentIntro';
import MessageBubble from './MessageBubble';
import { formatMessageTime } from '../utils/formatMessageTime';

export default function MessageList({ conversation }) {
  if (!conversation) {
    return (
      <div className="message-list">
        <p className="message-list-empty">Start a new research session.</p>
      </div>
    );
  }

  return (
    <div className="message-list">
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
              sources={msg.sources}
              status={msg.status}
              showAvatar={msg.role === 'user'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
