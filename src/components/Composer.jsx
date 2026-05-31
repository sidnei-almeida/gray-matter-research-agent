import { useState } from 'react';
import { FlaskConical, Send } from 'lucide-react';
import { composerShortcuts, MAX_INPUT_LENGTH } from '../data/mockData';

export default function Composer({
  onSend,
  loading = false,
  deepMode = false,
  onDeepModeChange,
  dynamicSuggestions = [],
}) {
  const [input, setInput] = useState('');

  const length = input.length;
  const canSend = !loading && length > 0 && length <= MAX_INPUT_LENGTH;

  const handleSend = () => {
    if (!canSend) return;
    onSend?.(input.trim(), { deep: deepMode });
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShortcut = (label) => {
    setInput((prev) => (prev ? `${prev} ${label}` : label));
  };

  const handleSuggestion = (text) => {
    if (loading) return;
    onSend?.(text, { deep: deepMode });
  };

  const showDynamic = dynamicSuggestions.length > 0;

  return (
    <footer className="composer panel">
      <div className="composer-toolbar">
        <button
          type="button"
          className={`composer-deep-toggle${deepMode ? ' composer-deep-toggle--on' : ''}`}
          onClick={() => onDeepModeChange?.(!deepMode)}
          disabled={loading}
          aria-pressed={deepMode}
          title="Use POST /api/research for deeper sources and more papers"
        >
          <FlaskConical size={14} aria-hidden="true" />
          Deep research
        </button>
        {deepMode ? (
          <span className="composer-deep-hint">ArXiv + web · up to 120s</span>
        ) : null}
      </div>

      {showDynamic ? (
        <div className="composer-dynamic-suggestions" aria-label="Suggested follow-ups">
          {dynamicSuggestions.map((text) => (
            <button
              key={text}
              type="button"
              className="composer-dynamic-chip"
              disabled={loading}
              onClick={() => handleSuggestion(text)}
            >
              {text}
            </button>
          ))}
        </div>
      ) : (
        <div className="composer-shortcuts">
          {composerShortcuts.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={loading}
              onClick={() => handleShortcut(chip.label)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="composer-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={
            deepMode
              ? 'Deep research question (papers + web, single turn)…'
              : 'Ask your research question…'
          }
          rows={1}
          disabled={loading}
        />
        <button type="button" className="composer-send" disabled={!canSend} onClick={handleSend}>
          <Send size={18} />
        </button>
      </div>

      <div className="composer-footer">
        <span className="char-count">
          {length} / {MAX_INPUT_LENGTH}
        </span>
      </div>
    </footer>
  );
}
