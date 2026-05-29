import {
  Atom,
  Beaker,
  Calculator,
  ChevronRight,
  Dna,
  FileSearch,
  Sparkles,
} from 'lucide-react';

const PROMPT_ICONS = [
  { match: /quantum/i, Icon: Atom },
  { match: /crystal/i, Icon: Beaker },
  { match: /paper|healthcare|AI/i, Icon: FileSearch },
  { match: /CRISPR/i, Icon: Dna },
  { match: /Calculate|yield|reaction/i, Icon: Calculator },
  { match: /batter/i, Icon: Sparkles },
];

function getPromptIcon(text) {
  const found = PROMPT_ICONS.find(({ match }) => match.test(text));
  return found?.Icon ?? Sparkles;
}

export default function SuggestionChips({ items, onSelect }) {
  return (
    <div className="suggestion-chips">
      {items.map((item) => {
        const Icon = getPromptIcon(item);
        return (
          <button
            key={item}
            type="button"
            className="suggestion-chip"
            onClick={() => onSelect?.(item)}
          >
            <span className="suggestion-chip-icon" aria-hidden="true">
              <Icon size={15} strokeWidth={1.6} />
            </span>
            <span className="suggestion-chip-text">{item}</span>
            <ChevronRight className="suggestion-chip-arrow" size={15} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}
