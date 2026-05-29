import { labTools, suggestedPrompts } from '../data/mockData';
import ToolCard from './ToolCard';
import LabVitals from './LabVitals';
import SuggestionChips from './SuggestionChips';

export default function LabToolsPanel({ onPromptSelect }) {
  return (
    <aside className="lab-tools-panel">
      <section className="lab-tools-section">
        <h2 className="section-title">Lab Tools</h2>
        <div className="tool-cards">
          {labTools.map((tool) => (
            <ToolCard
              key={tool.id}
              toolId={tool.id}
              title={tool.title}
              description={tool.description}
              status={tool.status}
            />
          ))}
        </div>
      </section>

      <section className="suggested-section">
        <h2 className="section-title">Suggested Prompts</h2>
        <SuggestionChips items={suggestedPrompts} onSelect={onPromptSelect} />
      </section>

      <LabVitals />
    </aside>
  );
}
