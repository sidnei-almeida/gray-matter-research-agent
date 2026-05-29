export function formatMessageContent(text) {
  if (!text) return '';

  let formatted = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="auto-link">$1</a>'
    )
    .replace(/\n/g, '<br>');

  return formatted;
}

export function normalizeArxivUrl(ref) {
  if (ref.startsWith('http')) return ref;
  if (ref.startsWith('arxiv:')) {
    return `https://arxiv.org/abs/${ref.replace('arxiv:', '').trim()}`;
  }
  if (/^\d{4}\.\d{4,5}/.test(ref)) {
    return `https://arxiv.org/abs/${ref}`;
  }
  return `https://${ref}`;
}

export function createMessage({ role, content, toolUsed, sources, attachments, suggestions, processingTime }) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    toolUsed: toolUsed || null,
    sources: sources || [],
    attachments: attachments || null,
    suggestions: suggestions || [],
    processingTime: processingTime ?? null,
  };
}

export function groupConversationsByDate(conversations) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  const groups = { Today: [], Yesterday: [], Previous: [] };

  for (const conv of conversations) {
    const updated = conv.updatedAt || conv.createdAt;
    if (updated >= todayStart) {
      groups.Today.push(conv);
    } else if (updated >= yesterdayStart) {
      groups.Yesterday.push(conv);
    } else {
      groups.Previous.push(conv);
    }
  }

  return groups;
}

export function truncateTitle(text, max = 42) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
