import SourceCard from './SourceCard';
import PaperCard from './PaperCard';
import AgentAvatar from './AgentAvatar';
import MessageMarkdown from './MessageMarkdown';
import { isLowConfidence } from '../utils/agentResponseNormalizer';
import { formatIntentLabel, formatToolLabel } from '../utils/formatAgentMeta';

function formatConfidenceLabel(confidence, confidenceScore) {
  if (confidenceScore != null) {
    return `${Math.round(Number(confidenceScore) * 100)}% confidence`;
  }
  if (confidence) return confidence;
  return null;
}

export default function MessageBubble({
  role,
  content,
  timestamp,
  toolUsed,
  toolsUsed = [],
  sources = [],
  papers = [],
  intent,
  researchPlan = [],
  confidence,
  confidenceScore,
  limitations = [],
  followUpQuestions = [],
  processingTime = null,
  researchMode = null,
  status = 'sent',
  showAvatar = false,
  onFollowUpSelect,
}) {
  const isUser = role === 'user';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const showLowConfidence =
    !isLoading && !isError && isLowConfidence(confidence, confidenceScore, intent);
  const confidenceLabel = formatConfidenceLabel(confidence, confidenceScore);
  const activeTools = toolsUsed?.length ? toolsUsed : toolUsed ? [toolUsed] : [];

  const getSourceKey = (source, index) => {
    if (typeof source === 'string') return source;
    return source?.id || source?.url || `source-${index}`;
  };

  const getPaperKey = (paper, index) => paper?.id || paper?.url || `paper-${index}`;

  return (
    <article className={`message-bubble-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && showAvatar && <AgentAvatar size="sm" className="message-avatar" />}

      <div
        className={`message-bubble ${isUser ? 'user-bubble card' : 'assistant-bubble'}${isError ? ' message-bubble--error' : ''}`}
      >
        {!isUser && activeTools.length > 0 && status === 'sent' && (
          <header className="message-meta">
            {activeTools.map((tool) => (
              <span key={tool} className="message-tool">
                {formatToolLabel(tool)}
              </span>
            ))}
          </header>
        )}

        {!isUser && (intent || researchMode === 'deep') && status === 'sent' && (
          <div className="message-intent">
            {researchMode === 'deep' ? (
              <>
                <span className="message-intent-label">Mode</span>
                <span className="message-intent-value">Deep research</span>
              </>
            ) : null}
            {intent ? (
              <>
                <span className="message-intent-label">Intent</span>
                <span className="message-intent-value">{formatIntentLabel(intent)}</span>
              </>
            ) : null}
          </div>
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
        ) : isUser ? (
          <div className="message-text">{content}</div>
        ) : (
          <MessageMarkdown content={content} />
        )}

        {!isLoading && !isError && researchPlan?.length > 0 && (
          <section className="message-trace" aria-label="Research plan">
            <h3 className="message-section-title">Agent trace</h3>
            <ol className="message-trace-list">
              {researchPlan.map((step) => (
                <li key={`${step.index}-${step.step}`}>
                  <span className="message-trace-step">{step.step}</span>
                  {step.tool ? <span className="message-trace-tool">{step.tool}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        )}

        {!isLoading && !isError && (confidenceScore != null || limitations?.length > 0) && (
          <section className="message-confidence-block">
            {confidenceScore != null ? (
              <>
                <p className="message-confidence-header">Confidence</p>
                <div className="message-confidence-meter">
                  <div className="message-confidence-track">
                    <div
                      className="message-confidence-fill"
                      style={{
                        '--confidence-pct': `${Math.min(100, Math.round(Number(confidenceScore) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="message-confidence-pct">
                    {Math.round(Number(confidenceScore) * 100)}%
                  </span>
                  <span className="message-confidence-raw">
                    ({Number(confidenceScore).toFixed(2)})
                  </span>
                </div>
              </>
            ) : confidenceLabel ? (
              <p className="message-confidence">
                <span className="message-confidence-label">Confidence</span>
                {confidenceLabel}
              </p>
            ) : null}
            {limitations?.length > 0 ? (
              <ul className="message-limitations">
                {limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        {showLowConfidence && (
          <div className="message-clarification card" role="note">
            The agent has low confidence in this answer. Consider refining your question or reviewing the cited
            sources before acting on this output.
          </div>
        )}

        {!isLoading && !isError && papers?.length > 0 && (
          <section className="message-papers" aria-label="Papers">
            <h3 className="message-section-title">Papers</h3>
            <div className="message-papers-grid">
              {papers.map((paper, index) => (
                <PaperCard key={getPaperKey(paper, index)} paper={paper} />
              ))}
            </div>
          </section>
        )}

        {!isLoading && sources?.length > 0 && (
          <section className="message-sources" aria-label="Sources">
            <h3 className="message-section-title">Sources</h3>
            {sources.map((source, index) => (
              <SourceCard key={getSourceKey(source, index)} source={source} />
            ))}
          </section>
        )}

        {!isLoading && !isError && followUpQuestions?.length > 0 && (
          <section className="message-follow-ups" aria-label="Suggested follow-ups">
            <h3 className="message-section-title">Follow-up questions</h3>
            <div className="message-follow-up-chips">
              {followUpQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="message-follow-up-chip"
                  onClick={() => onFollowUpSelect?.(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </section>
        )}

        {timestamp && !isLoading && (
          <footer className="message-footer-meta">
            <time className="message-time">{timestamp}</time>
            {processingTime != null && status === 'sent' && !isUser ? (
              <span className="message-processing-time">
                {Number(processingTime).toFixed(1)}s
              </span>
            ) : null}
          </footer>
        )}
      </div>

      {isUser && (
        <div className="message-avatar user-avatar" aria-hidden="true">
          U
        </div>
      )}
    </article>
  );
}
