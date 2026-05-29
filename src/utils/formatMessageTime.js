export function formatMessageTime(timestamp) {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(timestamp);
  }
}
