# Vercel Python Agent Migration — Design

## Context

The Gray Matter Research Agent backend (`langchain-autonomous-agent` repo) has run as a
Docker-based Hugging Face Space (`salmeida/langchain-agent`). HF tightened its free tier:
Docker Spaces on `cpu-basic` now require a PRO subscription, and the existing Space is
currently **paused** (`503: the space is paused, ask a maintainer to restart it`).

The frontend (`gray-matter-research-agent`, React/Vite, already deploy-ready for Vercel)
calls this backend over `VITE_API_BASE_URL`. We need the agent running again at zero
monthly hosting cost, with everything on Vercel's free (Hobby) tier.

## Goal

Move the existing Python/FastAPI/LangChain backend (~3300 lines: `agent/` pipeline —
router, planner, tools, evidence ranking, synthesizer, verifier — plus `api.py`,
`api_config.py`, `api_helpers.py`, `arxiv_search.py`) into the frontend repo as a Vercel
Python Serverless Function, with **no rewrite of pipeline logic**.

## Non-goals

- Rewriting the agent pipeline in JavaScript/TypeScript.
- Changing the agent's research behavior (classify → plan → tools → rank → synthesize →
  verify stays exactly as-is).
- Deleting or decommissioning the old `langchain-autonomous-agent` repo or the HF Space.

## Feasibility note: Vercel function duration

The frontend already budgets long timeouts for the agent: `CHAT_TIMEOUT_MS = 90000`,
`RESEARCH_TIMEOUT_MS = 120000` (`src/services/apiClient.js`). Vercel Hobby's default
function duration is short (10s), but **Fluid Compute** (default on new Vercel projects)
raises the Hobby cap to 300s — comfortably covering the pipeline's worst case (multiple
Groq LLM calls + arXiv/Wikipedia/DuckDuckGo tool calls). This must still be validated with
a real "deep" mode request after deploy (see Testing).

## Architecture

Single Vercel project, single repo (`gray-matter-research-agent` becomes a monorepo):

```
gray-matter-research-agent/
├── src/, public/, index.html, vite.config.js   ← frontend (unchanged)
├── api/
│   ├── index.py            ← FastAPI app (was api.py), ASGI entrypoint
│   ├── agent/                ← pipeline package, copied verbatim (no logic changes)
│   ├── api_config.py, api_helpers.py, arxiv_search.py
│   └── requirements.txt      ← backend-only Python deps
├── vercel.json                ← frontend build + "/api/*" rewrite → api/index.py + maxDuration
```

`langchain-autonomous-agent` (this repo) stays as-is: no further deploys, kept as
history/reference. The paused HF Space is left paused (not deleted) as a fallback until
the Vercel deploy is validated in production.

## Request flow & configuration

- Frontend and backend become **same-origin** (both served from the Vercel domain), so
  `VITE_API_BASE_URL` defaults to `""` (relative paths: `/api/chat`, `/api/health`)
  instead of the current cross-origin HF URL.
- CORS middleware in `api_config.py` can stay (harmless same-origin), but is no longer
  load-bearing.
- Secrets (`GROQ_API_KEY`, optionally `GRAY_MATTER_API_KEY`) are set in the Vercel
  project's Environment Variables — never committed, same posture as the current
  `.env`/HF Secrets setup.
- `vercel.json` sets `functions["api/index.py"].maxDuration` to 120s, and the Vercel
  project must have Fluid Compute enabled (verify in dashboard — default for new
  projects, but confirm since this project may predate that default).

## Error handling

- Cold starts: Python + LangChain imports are heavy; first request after idle may be
  slow. No new handling needed — `apiClient.js` already surfaces a
  "lab may be cold-starting, try again" message for slow/timeout responses.
- Missing `GROQ_API_KEY`: `get_agent()` already raises a clear 500 with a logged error;
  behavior is unchanged, only the hosting location changes.
- Deep-mode timeout risk: if real-world testing shows the 120s budget is too tight,
  fallback options (not implemented up front) are: raise `maxDuration` further (up to
  300s under Fluid Compute), or trim the `revise_if_needed` verification step for `deep`
  queries.

## Testing

- Existing Python test suite (`test_agent.py`, `test_arxiv_search.py`) is unaffected —
  pipeline logic doesn't change, so these keep validating it locally/CI as today.
- Post-deploy smoke test (manual): `GET /api/health`, one simple chat query, and one
  `depth=deep` query — confirming the deep query completes within the configured
  `maxDuration`.

## Migration steps (for the implementation plan)

1. Copy `agent/`, `api.py` → `api/index.py`, `api_config.py`, `api_helpers.py`,
   `arxiv_search.py` into this repo under `api/`.
2. Create `api/requirements.txt` with backend deps (langchain, langchain-groq, langgraph,
   duckduckgo-search, ddgs, wikipedia, arxiv, fastapi, uvicorn, pydantic, requests,
   python-dotenv).
3. Add `vercel.json` rewrite (`/api/(.*)` → `api/index.py`) and `maxDuration`.
4. Update `apiClient.js` — `VITE_API_BASE_URL` defaults to `""`.
5. Set env vars in the Vercel dashboard (`GROQ_API_KEY` at minimum).
6. Deploy, run the smoke tests above.
7. On success: push to `sidnei-almeida/gray-matter-research-agent` on GitHub; future
   pushes auto-deploy.

## Out of scope / follow-ups

- Rotating the Hugging Face token pasted earlier in this session (`inelialmeida`
  account) — unrelated to this migration, but should be done for hygiene since the token
  is now in chat history.
- Deciding the long-term fate of the paused HF Space and the `langchain-autonomous-agent`
  repo — deferred until the Vercel deploy is proven in production.
