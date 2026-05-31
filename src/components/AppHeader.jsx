import { Activity, ChevronDown, FlaskConical } from 'lucide-react';

export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <div className="app-header-titles">
          <div className="app-header-title-row">
            <h1 className="app-header-title">
              <span className="app-header-title-main">Gray Matter</span>
              <span className="app-header-title-labs">LABS</span>
            </h1>
            <div className="app-header-status">
              <span className="pulse-dot" aria-hidden="true" />
              Lab Online
            </div>
          </div>
          <p className="app-header-tagline">Advanced Research. Precise Answers.</p>
        </div>
      </div>

      <div className="app-header-actions">
        <button type="button" className="header-icon-btn" aria-label="Laboratory">
          <FlaskConical size={20} strokeWidth={1.6} />
        </button>
        <button type="button" className="header-icon-btn" aria-label="Activity">
          <Activity size={20} strokeWidth={1.6} />
        </button>
        <button type="button" className="header-profile-btn" aria-label="Profile menu">
          <span className="header-profile-avatar">W.</span>
          <ChevronDown size={14} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
