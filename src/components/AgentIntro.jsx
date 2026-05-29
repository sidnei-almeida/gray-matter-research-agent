import { agentIntro } from '../data/mockData';
import AgentAvatar from './AgentAvatar';

export default function AgentIntro() {
  return (
    <section className="agent-intro" aria-label="Research agent profile">
      <div className="agent-intro-bg" aria-hidden="true" />
      <div className="agent-intro-profile">
        <AgentAvatar size="lg" className="agent-intro-avatar" />
        <div className="agent-intro-copy">
          <div className="agent-intro-name-row">
            <h2 className="agent-intro-name">{agentIntro.name}</h2>
            <span className="agent-intro-ai-badge">AI</span>
          </div>
          <p className="agent-intro-role">{agentIntro.role}</p>
          <p className="agent-intro-quote">&ldquo;{agentIntro.quote}&rdquo;</p>
        </div>
      </div>
    </section>
  );
}
