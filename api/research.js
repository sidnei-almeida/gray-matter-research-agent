import { invokeAgent } from './_lib/agent.js';
import { parseJsonBody, sendJson, withApi } from './_lib/http.js';
import { buildEnrichedResponse } from './_lib/responses.js';

const MAX_QUESTION_CHARS = 8000;
const VALID_DEPTHS = ['quick', 'standard', 'deep'];

export default withApi(['POST'], async (req, res) => {
  const start = Date.now();
  const body = await parseJsonBody(req);

  const question = String(body.question || '').trim();
  if (!question) {
    sendJson(res, 422, { detail: '`question` is required.' });
    return;
  }
  if (question.length > MAX_QUESTION_CHARS) {
    sendJson(res, 422, { detail: `\`question\` exceeds ${MAX_QUESTION_CHARS} characters.` });
    return;
  }

  const depth = VALID_DEPTHS.includes(body.depth) ? body.depth : 'standard';

  let maxSources = Number(body.max_sources ?? 8);
  if (!Number.isFinite(maxSources)) maxSources = 8;
  maxSources = Math.min(20, Math.max(1, Math.trunc(maxSources)));
  if (depth === 'deep') maxSources = Math.max(maxSources, 12);

  try {
    const result = await invokeAgent({
      messages: [{ role: 'user', content: question }],
      depth,
      max_sources: maxSources,
    });

    const payload = buildEnrichedResponse(result, question);
    payload.processing_time = Math.round(((Date.now() - start) / 1000) * 100) / 100;
    payload.depth = depth;
    sendJson(res, 200, payload);
  } catch (error) {
    console.error('Research error:', error);
    sendJson(res, 200, {
      answer: 'Deep research request failed. Try a more specific question.',
      question,
      depth,
      processing_time: Math.round(((Date.now() - start) / 1000) * 100) / 100,
      confidence: 0.0,
    });
  }
});
