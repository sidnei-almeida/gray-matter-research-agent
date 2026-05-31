import { FlaskConical, GripVertical, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { groupConversationsByDate } from '../utils/dateGroups';
import AgentAvatar from './AgentAvatar';
import GmLogo from './GmLogo';

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
}) {
  const groups = groupConversationsByDate(conversations);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <GmLogo variant="compact" />
        <span className="sidebar-status">
          <span className="pulse-dot" aria-hidden="true" />
          Lab Online
        </span>
      </div>

      <button type="button" className="new-chat-button" onClick={onCreateConversation}>
        <span className="new-chat-leading">
          <Plus size={16} strokeWidth={2} />
        </span>
        <span className="new-chat-label">New Chat</span>
        <span className="new-chat-divider" aria-hidden="true" />
        <span className="new-chat-trailing">
          <FlaskConical size={18} strokeWidth={1.5} />
        </span>
      </button>

      <nav className="conversation-list">
        {Object.entries(groups).map(([group, items]) =>
          items.length > 0 ? (
            <div key={group} className="conversation-group">
              <h2 className="conversation-group-label">{group}</h2>
              <ul>
                {items.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  return (
                    <li key={conv.id} className="conversation-list-item">
                      <button
                        type="button"
                        className={`conversation-item${isActive ? ' active' : ''}`}
                        onClick={() => onSelectConversation(conv.id)}
                      >
                        <MessageCircle
                          className="conversation-icon"
                          size={16}
                          strokeWidth={1.6}
                        />
                        <span className="conversation-title">{conv.title}</span>
                        {isActive ? (
                          <span className="conversation-more" aria-hidden="true">
                            <GripVertical size={14} strokeWidth={2} />
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="conversation-delete"
                        aria-label={`Delete ${conv.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="agent-profile">
          <AgentAvatar size="md" />
          <div>
            <strong>Heisenberg Research Agent</strong>
            <span>Scientific mode</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
