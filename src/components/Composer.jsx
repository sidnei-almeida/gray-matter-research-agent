import { useState } from 'react';
import { Send } from 'lucide-react';
import { composerShortcuts, MAX_INPUT_LENGTH } from '../data/mockData';

export default function Composer({ onSend, loading = false }) {
  const [input, setInput] = useState('');

  const length = input.length;
  const canSend = !loading && length > 0 && length <= MAX_INPUT_LENGTH;

  const handleSend = () => {
    if (!canSend) return;
    onSend?.(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShortcut = (label) => {
    setInput((prev) => (prev ? `${prev} [${label}] ` : `[${label}] `));
  };

  return (
    <footer className="composer panel">
      <div className="composer-shortcuts">
        {composerShortcuts.map((chip) => (
          <button key={chip.id} type="button" onClick={() => handleShortcut(chip.label)}>
            {chip.label}
          </button>
        ))}
      </div>

      <div className="composer-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Ask your research question..."
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
