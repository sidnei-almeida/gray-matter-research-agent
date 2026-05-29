import { chatStatusBadges } from '../data/mockData';

export default function ChatHeader() {
  return (
    <header className="chat-header panel">
      <div className="chat-header-left">
        <span className="chat-eyebrow">Research Session</span>
        <h1>Gray Matter</h1>
        <p className="chat-subtitle">Research Intelligence Session</p>
      </div>

      <div className="chat-status-badges">
        {chatStatusBadges.map((badge) => (
          <span key={badge.id} className="status-badge">
            {badge.label}
          </span>
        ))}
      </div>
    </header>
  );
}
