export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://salmeida-langchain-agent.hf.space';

export const REQUEST_TIMEOUT_MS = 9000;
export const CHAT_TIMEOUT_MS = 25000;
export const MAX_INPUT_LENGTH = 2000;

export async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestJson(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {
  const response = await fetchWithTimeout(url, options, timeout);
  const text = await response.text().catch(() => '');
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new Error('Invalid JSON response.');
      }
    }
  }

  if (!response.ok) {
    const message = data?.detail || data?.error || text || `Status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return data ?? {};
}

export function formatApiError(error) {
  const message = error?.message || 'Unknown error';

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Connection error. Check if the API is online and your internet connection.';
  }
  if (message.includes('CORS')) {
    return 'CORS error. The API needs to allow requests from your domain.';
  }
  if (message.includes('500')) {
    return 'Internal server error. The API may be experiencing issues.';
  }
  if (message.includes('404')) {
    return 'Endpoint not found. Please check if the API is configured correctly.';
  }
  if (message.includes('timed out')) {
    return 'Request timed out. The lab may be cold-starting — try again in a moment.';
  }

  return message;
}
