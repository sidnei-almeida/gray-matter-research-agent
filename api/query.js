import { invokeAgent } from './_lib/agent.js';
import { parseJsonBody, sendJson, withApi } from './_lib/http.js';
import { buildEnrichedResponse } from './_lib/responses.js';

const MAX_QUESTION_CHARS = 8000;

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

  try {
    const result = await invokeAgent({ messages: [{ role: 'user', content: question }] });
    const payload = buildEnrichedResponse(result, question);
    payload.processing_time = Math.round(((Date.now() - start) / 1000) * 100) / 100;
    sendJson(res, 200, payload);
  } catch (error) {
    console.error('Query error:', error);
    sendJson(res, 200, {
      answer: 'Unable to process your question. Please try again with a clearer query.',
      question,
      processing_time: Math.round(((Date.now() - start) / 1000) * 100) / 100,
      confidence: 0.0,
      limitations: ['Request processing failed.'],
    });
  }
});
