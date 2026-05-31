import AgentIntro from './AgentIntro';
import MessageBubble from './MessageBubble';
import { formatMessageTime } from '../utils/formatMessageTime';

export default function MessageList({ conversation, onFollowUpSelect }) {
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
