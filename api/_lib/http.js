/**
 * Shared HTTP plumbing for the Vercel Node functions:
 * CORS, optional API-key gate, body-size limit, JSON body parsing.
 *
 * Mirrors the behaviour of the previous FastAPI middleware stack.
 */

const MAX_BODY_BYTES = Number(process.env.MAX_REQUEST_BYTES || 65536);

export function getCorsOrigins() {
  const raw = (process.env.CORS_ORIGINS || '*').trim();
  if (raw === '*') return ['*'];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

function resolveAllowOrigin(req) {
  const origins = getCorsOrigins();
  if (origins.includes('*')) return '*';
  const requestOrigin = req.headers.origin;
  if (requestOrigin && origins.includes(requestOrigin)) return requestOrigin;
  return origins[0] || '*';
}

export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key,Accept');
}

export function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/** Optional API key gate — active only when GRAY_MATTER_API_KEY is set. */
function checkApiKey(req) {
  const expected = process.env.GRAY_MATTER_API_KEY;
  if (!expected) return true;

  const headerKey = req.headers['x-api-key'];
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();

  return headerKey === expected || bearer === expected;
}

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error('Request body too large.');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function parseJsonBody(req) {
  const raw = await readRawBody(req);
  if (Buffer.byteLength(raw || '', 'utf8') > MAX_BODY_BYTES) {
    const err = new Error('Request body too large.');
    err.status = 413;
    throw err;
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON body.');
    err.status = 400;
    throw err;
  }
}

/**
 * Wraps a handler with CORS, preflight, method guard, API key and error handling.
 *
 * @param {string[]} methods allowed HTTP methods
 * @param {(req, res) => Promise<void>} handler
 */
export function withApi(methods, handler) {
  return async function wrapped(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (!methods.includes(req.method)) {
      sendJson(res, 405, { detail: `Method ${req.method} not allowed.` });
      return;
    }

    if (!checkApiKey(req)) {
      sendJson(res, 401, { detail: 'Invalid or missing API key.' });
      return;
    }

    try {
      await handler(req, res);
    } catch (error) {
      const status = error?.status || 500;
      if (status >= 500) {
        console.error('Unhandled API error:', error);
        sendJson(res, 500, { detail: 'An internal error occurred. Please retry later.' });
      } else {
        sendJson(res, status, { detail: error.message });
      }
    }
  };
}
