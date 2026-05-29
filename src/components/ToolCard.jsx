import { ExternalLink } from 'lucide-react';
import ToolIcon from './ToolIcon';

export default function ToolCard({ toolId, title, description, status }) {
  return (
    <article className="tool-card card">
      <ToolIcon toolId={toolId} />
      <div className="tool-card-content">
        <div className="tool-card-header">
          <div className="tool-card-body">
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <span className="tool-card-link" aria-hidden="true">
            <ExternalLink size={14} />
          </span>
        </div>
        <span className="tool-card-status">{status}</span>
      </div>
    </article>
  );
}
