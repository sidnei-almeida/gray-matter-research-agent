import SourceCard from './SourceCard';
import AgentAvatar from './AgentAvatar';

export default function MessageBubble({
  role,
  content,
  timestamp,
  toolUsed,
  sources = [],
  status = 'sent',
  showAvatar = false,
}) {
  const isUser = role === 'user';
  const isLoading = status === 'loading';
  const isError = status === 'error';

  return (
    <article className={`message-bubble-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && showAvatar && <AgentAvatar size="sm" className="message-avatar" />}

      <div
        className={`message-bubble ${isUser ? 'user-bubble card' : 'assistant-bubble'}${isError ? ' message-bubble--error' : ''}`}
      >
        {!isUser && toolUsed && status === 'sent' && (
          <header className="message-meta">
            <span className="message-tool">{toolUsed}</span>
          </header>
        )}

        {isLoading ? (
          <div className="message-thinking" aria-live="polite">
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <span>{content}</span>
          </div>
        ) : (
          <p className="message-text">{content}</p>
        )}

        {!isLoading && sources?.length > 0 && (
          <div className="message-sources">
            {sources.map((url) => (
              <SourceCard key={url} url={url} />
            ))}
          </div>
        )}

        {timestamp && !isLoading && <time className="message-time">{timestamp}</time>}
      </div>

      {isUser && (
        <div className="message-avatar user-avatar" aria-hidden="true">
          U
        </div>
      )}
    </article>
  );
}
