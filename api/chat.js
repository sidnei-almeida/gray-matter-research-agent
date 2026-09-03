import { invokeAgent } from './_lib/agent.js';
import { parseJsonBody, sendJson, withApi } from './_lib/http.js';
import { prepareMessages } from './_lib/messages.js';
import { buildEnrichedResponse } from './_lib/responses.js';

const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 8000;

export default withApi(['POST'], async (req, res) => {
  const start = Date.now();
  const body = await parseJsonBody(req);

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (!rawMessages.length) {
    sendJson(res, 422, { detail: '`messages` must be a non-empty array.' });
    return;
  }
  if (rawMessages.length > MAX_MESSAGES) {
    sendJson(res, 422, { detail: `\`messages\` may contain at most ${MAX_MESSAGES} items.` });
    return;
  }
  if (rawMessages.some((m) => String(m?.content || '').length > MAX_CONTENT_CHARS)) {
    sendJson(res, 422, { detail: `Message content exceeds ${MAX_CONTENT_CHARS} characters.` });
    return;
  }

  const messages = prepareMessages(rawMessages);

  try {
    const result = await invokeAgent({ messages });
    const payload = buildEnrichedResponse(result);
    const processingTime = Math.round(((Date.now() - start) / 1000) * 100) / 100;

    sendJson(res, 200, {
      message: { role: 'assistant', content: payload.answer },
      tools_used: payload.tools_used,
      intent: payload.intent,
      research_plan: payload.research_plan,
      sources: payload.sources,
      papers: payload.papers,
      confidence: payload.confidence,
      limitations: payload.limitations,
      follow_up_questions: payload.follow_up_questions,
      mode: payload.mode,
      reasoning_effort: payload.reasoning_effort,
      agent_steps: payload.agent_steps,
      structured: payload.structured,
      processing_time: processingTime,
    });
  } catch (error) {
    console.error('Chat error:', error);
    sendJson(res, 200, {
      message: {
        role: 'assistant',
        content: 'Request failed. Please retry with a science or research question.',
      },
      processing_time: Math.round(((Date.now() - start) / 1000) * 100) / 100,
      confidence: 0.0,
    });
  }
});
