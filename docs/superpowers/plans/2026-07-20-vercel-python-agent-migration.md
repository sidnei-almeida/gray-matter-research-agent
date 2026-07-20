# Vercel Python Agent Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Gray Matter Research Agent's Python/FastAPI/LangChain backend into the `gray-matter-research-agent` frontend repo as a Vercel Python Serverless Function, so the whole app runs as one same-origin, zero-cost Vercel deployment — replacing the paused, PRO-only Hugging Face Space.

**Architecture:** Monorepo. Frontend (React/Vite) stays at repo root, unchanged. Backend source (`agent/` pipeline, `api_config.py`, `api_helpers.py`, `arxiv_search.py`) is copied verbatim into `api/`, with the FastAPI app entrypoint becoming `api/index.py`. Vercel auto-detects `api/index.py`'s `app` object as a Python Serverless Function exposed at `/api/*`; the frontend calls it same-origin, so `VITE_API_BASE_URL` becomes a relative empty string instead of the old cross-origin HF URL.

**Tech Stack:** Python 3 (FastAPI, LangChain, langchain-groq, LangGraph), Vercel Python Runtime, React + Vite, Vercel Serverless Functions with Fluid Compute.

## Global Constraints

- No changes to agent pipeline logic (router, planner, tools, evidence ranking, synthesizer, verifier) — copy verbatim, per the design spec's non-goals.
- Zero monthly hosting cost — must run on Vercel's free Hobby tier.
- Frontend and backend become same-origin after migration; no cross-origin/CORS dependency going forward.
- Secrets (`GROQ_API_KEY`, optional `GRAY_MATTER_API_KEY`) are set via the Vercel dashboard's Environment Variables — never committed to the repo.
- Source spec: `docs/superpowers/specs/2026-07-20-vercel-python-agent-migration-design.md` (this repo).

---

### Task 1: Scaffold the backend package under `api/`

**Files:**
- Create: `api/agent/__init__.py`, `api/agent/evidence.py`, `api/agent/graph.py`, `api/agent/messages.py`, `api/agent/planner.py`, `api/agent/prompts.py`, `api/agent/router.py`, `api/agent/state.py`, `api/agent/synthesizer.py`, `api/agent/tools.py`, `api/agent/verifier.py` (verbatim copies from `../langchain-autonomous-agent/agent/`)
- Create: `api/api_config.py`, `api/api_helpers.py`, `api/arxiv_search.py` (verbatim copies from `../langchain-autonomous-agent/`)
- Test: manual import check (Step 3 below)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: importable `agent` package (`agent.graph.GrayMatterResearchAgent`, `agent.graph.create_scientific_agent`, `agent.messages.prepare_messages` — re-exported from `api/agent/__init__.py`), and sibling modules `api_config` (`get_cors_origins`, `APIKeyMiddleware`, `RequestSizeLimitMiddleware`), `api_helpers` (`build_enriched_response`), `arxiv_search`. Task 2 imports all of these from `api/index.py`.

Deliberately **not** copied: `agent/__main__.py` (CLI entrypoint, not imported by the API, unused on Vercel) and `app.py` (Hugging Face-specific `uvicorn.run` launcher, superseded by Vercel's own function invocation).

- [ ] **Step 1: Copy the backend source tree verbatim**

Run from the `gray-matter-research-agent` repo root (adjust the source path if your `langchain-autonomous-agent` checkout lives elsewhere):

```bash
mkdir -p api/agent
cp ../langchain-autonomous-agent/agent/__init__.py api/agent/__init__.py
cp ../langchain-autonomous-agent/agent/evidence.py api/agent/evidence.py
cp ../langchain-autonomous-agent/agent/graph.py api/agent/graph.py
cp ../langchain-autonomous-agent/agent/messages.py api/agent/messages.py
cp ../langchain-autonomous-agent/agent/planner.py api/agent/planner.py
cp ../langchain-autonomous-agent/agent/prompts.py api/agent/prompts.py
cp ../langchain-autonomous-agent/agent/router.py api/agent/router.py
cp ../langchain-autonomous-agent/agent/state.py api/agent/state.py
cp ../langchain-autonomous-agent/agent/synthesizer.py api/agent/synthesizer.py
cp ../langchain-autonomous-agent/agent/tools.py api/agent/tools.py
cp ../langchain-autonomous-agent/agent/verifier.py api/agent/verifier.py
cp ../langchain-autonomous-agent/api_config.py api/api_config.py
cp ../langchain-autonomous-agent/api_helpers.py api/api_helpers.py
cp ../langchain-autonomous-agent/arxiv_search.py api/arxiv_search.py
```

- [ ] **Step 2: Verify the copy is byte-identical to the source**

```bash
diff -r api/agent ../langchain-autonomous-agent/agent
diff api/api_config.py ../langchain-autonomous-agent/api_config.py
diff api/api_helpers.py ../langchain-autonomous-agent/api_helpers.py
diff api/arxiv_search.py ../langchain-autonomous-agent/arxiv_search.py
```

Expected: no output from any `diff` (no differences).

- [ ] **Step 3: Verify the package imports correctly**

You need the runtime deps installed to check this. If you don't already have a virtualenv with `langchain`, `langchain-groq`, `langchain-community`, `langgraph`, `wikipedia`, `arxiv`, `duckduckgo-search`, `ddgs`, `pydantic`, `requests`, `python-dotenv` installed, create one first:

```bash
python3 -m venv /tmp/gm-migration-venv
source /tmp/gm-migration-venv/bin/activate
pip install -q langchain langchain-community langchain-groq langgraph duckduckgo-search ddgs python-dotenv wikipedia arxiv pydantic requests
```

Then, from inside `api/`:

```bash
cd api
GROQ_API_KEY=test-key-for-migration-check python3 -c "
from agent import create_scientific_agent, prepare_messages
from api_config import APIKeyMiddleware, RequestSizeLimitMiddleware, get_cors_origins
from api_helpers import build_enriched_response
import arxiv_search
print('imports OK')
"
cd ..
```

Expected: `imports OK` printed, no `ImportError`/`ModuleNotFoundError`.

- [ ] **Step 4: Commit**

```bash
git add api/agent api/api_config.py api/api_helpers.py api/arxiv_search.py
git commit -m "Copy agent pipeline and API support modules into api/ for Vercel"
```

---

### Task 2: Create the FastAPI entrypoint at `api/index.py`

**Files:**
- Create: `api/index.py` (copy of `../langchain-autonomous-agent/api.py`, with the health-check route path changed)
- Create: `api/requirements.txt`
- Test: manual import + local `uvicorn` smoke test (Steps 4–5 below)

**Interfaces:**
- Consumes: `agent`, `api_config`, `api_helpers`, `arxiv_search` from Task 1 (unchanged import statements — `from agent import create_scientific_agent, prepare_messages`, `from api_config import APIKeyMiddleware, RequestSizeLimitMiddleware, get_cors_origins`, `from api_helpers import build_enriched_response`).
- Produces: a top-level `app` variable (`fastapi.FastAPI` instance) — the exact name and type Vercel's Python runtime requires to detect and serve the function. Routes: `GET /`, `GET /api/health` (renamed from `/health`), `GET /api/tools`, `POST /api/query`, `POST /api/chat`, `POST /api/research`. Task 5 (frontend) depends on `GET /api/health`, `POST /api/chat`, `POST /api/research` being reachable at those exact paths.

**Why the rename:** the original app defines `/health` without an `/api` prefix. Vercel's zero-config Python routing only auto-exposes files under `api/` at the `/api/*` path — a bare `/health` request would fall through to the frontend's SPA catch-all rewrite instead of reaching this function. Renaming to `/api/health` keeps all backend routes under the one prefix Vercel wires up automatically, with no custom `vercel.json` rewrites needed.

- [ ] **Step 1: Copy `api.py` to `api/index.py`**

```bash
cp ../langchain-autonomous-agent/api.py api/index.py
```

- [ ] **Step 2: Rename the health-check route to `/api/health`**

In `api/index.py`, find this line (originally `api.py:219`):

```python
@app.get("/health", response_model=HealthResponse, tags=["General"])
```

Replace it with:

```python
@app.get("/api/health", response_model=HealthResponse, tags=["General"])
```

Also update the HTML landing page string a few lines above it (originally `api.py:205-214`, the `<ul>` of documented endpoints) — find:

```python
  <li><code>GET /health</code> — health check</li>
```

(if present verbatim; check the surrounding `<ul>` block in the copied file) and replace with:

```python
  <li><code>GET /api/health</code> — health check</li>
```

If the landing page doesn't list `/health` verbatim, skip this part — it's a cosmetic string only, not load-bearing.

- [ ] **Step 3: Create `api/requirements.txt`**

```
langchain
langchain-community
langchain-groq
langgraph
duckduckgo-search
ddgs
python-dotenv
wikipedia
arxiv
fastapi
pydantic
requests
```

This is the original `../langchain-autonomous-agent/requirements.txt` minus `uvicorn[standard]` — Vercel's Python runtime invokes the ASGI `app` directly and doesn't need an embedded server, so including `uvicorn` would only add unnecessary bundle size and cold-start weight. (`uvicorn` is still needed for the *local* smoke test in Step 5 below — install it in your local venv, just don't ship it to Vercel.)

- [ ] **Step 4: Verify `api/index.py` imports and the FastAPI app builds**

Using the same venv from Task 1 Step 3 (plus `fastapi` — already installed if you ran Task 1's pip install with the trimmed list above, otherwise `pip install fastapi`):

```bash
cd api
GROQ_API_KEY=test-key-for-migration-check python3 -c "
from index import app
print(type(app), app.title)
"
cd ..
```

Expected: prints `<class 'fastapi.applications.FastAPI'> Gray Matter Research Agent API`, no errors.

- [ ] **Step 5: Local smoke test with `uvicorn`**

```bash
source /tmp/gm-migration-venv/bin/activate
pip install -q uvicorn
cd api
GROQ_API_KEY=test-key-for-migration-check python3 -m uvicorn index:app --port 8787 &
UVICORN_PID=$!
sleep 2
curl -s http://127.0.0.1:8787/api/health
echo
kill $UVICORN_PID
cd ..
```

Expected: the `curl` prints a JSON body with `"status":"healthy"` and `"agent_initialized":true`. This only exercises app wiring (agent construction), not a real Groq call, so the placeholder `GROQ_API_KEY` is fine here.

- [ ] **Step 6: Commit**

```bash
git add api/index.py api/requirements.txt
git commit -m "Add FastAPI entrypoint and Python requirements for the Vercel function"
```

---

### Task 3: Migrate the backend test suite into `api/`

**Files:**
- Create: `api/test_agent.py`, `api/test_arxiv_search.py` (verbatim copies from `../langchain-autonomous-agent/`)

**Interfaces:**
- Consumes: `agent.router._heuristic_classify` and other internals from Task 1's `api/agent/` package, plus `arxiv_search` — both already verbatim, so the tests' existing inline imports (e.g. `from agent.router import _heuristic_classify`) resolve unchanged.
- Produces: a `pytest`-runnable regression suite for the pipeline logic, runnable from `api/` exactly as it was runnable from the old repo root.

- [ ] **Step 1: Copy the test files**

```bash
cp ../langchain-autonomous-agent/test_agent.py api/test_agent.py
cp ../langchain-autonomous-agent/test_arxiv_search.py api/test_arxiv_search.py
```

- [ ] **Step 2: Verify they're byte-identical to the source**

```bash
diff api/test_agent.py ../langchain-autonomous-agent/test_agent.py
diff api/test_arxiv_search.py ../langchain-autonomous-agent/test_arxiv_search.py
```

Expected: no output.

- [ ] **Step 3: Run the suite from its new location**

```bash
source /tmp/gm-migration-venv/bin/activate
pip install -q pytest
cd api
python3 -m pytest test_agent.py test_arxiv_search.py -v
cd ..
```

Expected: all tests pass (same pass/fail results as running them from the old repo root — this migration doesn't touch pipeline logic, so results must match).

- [ ] **Step 4: Commit**

```bash
git add api/test_agent.py api/test_arxiv_search.py
git commit -m "Bring the backend test suite along into api/"
```

---

### Task 4: Configure Vercel for the Python function

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `api/index.py`'s existence from Task 2 (referenced by path in the `functions` config).
- Produces: a `vercel.json` that, on deploy, gives the `/api/*` function up to 120s of execution time — covering the frontend's existing `CHAT_TIMEOUT_MS` (90s) and `RESEARCH_TIMEOUT_MS` (120s) budgets from `src/services/apiClient.js`.

- [ ] **Step 1: Read the current `vercel.json`**

It currently looks like this (verify before editing — if it has diverged, adapt the edit below accordingly rather than blindly overwriting):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/((?!assets/|.*\\..*).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*\\.(?:svg|png|ico|webp|woff2?))",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=604800, stale-while-revalidate=86400" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Add the `functions` block**

Edit `vercel.json` to add a `functions` key (any position at the top level; keep everything else unchanged):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "functions": {
    "api/index.py": { "maxDuration": 120 }
  },
  "rewrites": [{ "source": "/((?!assets/|.*\\..*).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*\\.(?:svg|png|ico|webp|woff2?))",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=604800, stale-while-revalidate=86400" }
      ]
    }
  ]
}
```

No change is needed to the existing `rewrites` entry: Vercel matches filesystem resources (static files and Serverless Functions, including the auto-detected `api/index.py`) before applying `rewrites`, so requests to `/api/health`, `/api/chat`, etc. reach the Python function directly and never fall through to the SPA `index.html` rewrite.

- [ ] **Step 3: Validate the JSON is well-formed**

```bash
python3 -c "import json; json.load(open('vercel.json')); print('valid JSON')"
```

Expected: `valid JSON`.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "Configure Vercel Python function duration for the agent API"
```

---

### Task 5: Point the frontend at the same-origin backend

**Files:**
- Modify: `src/services/apiClient.js:2` (the `API_BASE_URL` default)
- Modify: `src/services/researchAgent.js:13` (the health-check URL)

**Interfaces:**
- Consumes: `/api/health`, `/api/chat`, `/api/research` from Task 2's `api/index.py`.
- Produces: no new exports — `API_BASE_URL` keeps its existing name and is still consumed the same way by every caller in `src/services/`.

- [ ] **Step 1: Change the `API_BASE_URL` default**

In `src/services/apiClient.js`, find:

```javascript
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://salmeida-langchain-agent.hf.space';
```

Replace with:

```javascript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

- [ ] **Step 2: Fix the health-check call to use the `/api` prefix**

In `src/services/researchAgent.js`, find:

```javascript
    const data = await requestJson(`${API_BASE_URL}/health`, {
```

Replace with:

```javascript
    const data = await requestJson(`${API_BASE_URL}/api/health`, {
```

- [ ] **Step 3: Update `.env.example` and the README's env var docs**

In `.env.example`, ensure `VITE_API_BASE_URL` is documented as optional and empty by default:

```bash
# Leave unset for same-origin deployment (default — the API is served from /api on this same Vercel project).
# Only set this if you're pointing the frontend at a different backend origin.
VITE_API_BASE_URL=
```

In `README.md`, update the line `> **Production agent:** \`https://salmeida-langchain-agent.hf.space\` — override with \`VITE_API_BASE_URL\` if you host your own Space.` to:

```markdown
> **Production agent:** served from this same Vercel deployment at `/api` — set `VITE_API_BASE_URL` only if you point the frontend at a different backend origin.
```

- [ ] **Step 4: Run the frontend locally against the local backend from Task 2**

With the `uvicorn` server from Task 2 Step 5 still runnable, start it again in one terminal:

```bash
source /tmp/gm-migration-venv/bin/activate
cd api && GROQ_API_KEY=test-key-for-migration-check python3 -m uvicorn index:app --port 8787
```

In another terminal, point the frontend dev server at it and start it:

```bash
echo "VITE_API_BASE_URL=http://127.0.0.1:8787" > .env
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) in a browser. Confirm:
- The page loads without a console error about `/health`.
- The sidebar/health indicator (if the UI surfaces one) shows the backend as reachable — this exercises the `checkHealth()` call you just repointed to `/api/health`.

This step validates wiring only (agent constructs, health check succeeds); a full chat round-trip needs a real `GROQ_API_KEY` and is covered as a manual post-deploy check in Task 6, not required here.

Afterward, stop both servers and remove the local override so it doesn't leak into a commit:

```bash
rm .env
```

- [ ] **Step 5: Commit**

```bash
git add src/services/apiClient.js src/services/researchAgent.js .env.example README.md
git commit -m "Point the frontend at the same-origin /api backend instead of the HF Space"
```

---

### Task 6: Deploy to Vercel and validate in production

This task is operational (dashboard + manual verification), not scriptable end-to-end by an agent without an interactive Vercel login — it's the handoff to the human running this plan.

**Files:** none (no repo changes; this task pushes and configures the already-committed code).

- [ ] **Step 1: Push the branch**

```bash
git push origin master
```

(Or open a PR first, if that's your preferred flow for this repo — check `git log --oneline -5` to confirm you're still on `master`/the branch you intend to ship.)

- [ ] **Step 2: Import the project on Vercel (first deploy only)**

On [vercel.com/new](https://vercel.com/new), import `sidnei-almeida/gray-matter-research-agent`. Framework preset should auto-detect as Vite from `vercel.json`. Do not deploy yet — first add the environment variable in the next step.

- [ ] **Step 3: Set the `GROQ_API_KEY` environment variable**

In the Vercel project's Settings → Environment Variables, add `GROQ_API_KEY` with your real Groq key, scoped to Production (and Preview, if you want preview deploys to work too). This is the only required secret — `GRAY_MATTER_API_KEY` is optional (only needed if you want the `APIKeyMiddleware` gate active).

- [ ] **Step 4: Confirm Fluid Compute is enabled**

In Settings → Functions, confirm Fluid Compute is on for this project (it's the default for new projects, but verify — it's what makes the 120s `maxDuration` from Task 4 available on the free Hobby tier). If it's off, enable it.

- [ ] **Step 5: Deploy**

Trigger the deploy (via the dashboard's Deploy button, or it will auto-trigger from the `git push` in Step 1 once the project is connected).

- [ ] **Step 6: Post-deploy smoke test**

Once deployed, replace `<your-deployment-url>` and run:

```bash
curl -s https://<your-deployment-url>/api/health
echo
curl -s -X POST https://<your-deployment-url>/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is CRISPR-Cas9?"}]}'
```

Expected: `/api/health` returns `"status":"healthy"`; `/api/chat` returns a JSON body with a real synthesized `answer` (this call uses your real `GROQ_API_KEY` and will take a few seconds).

Then, in a browser, open the deployed URL, send one chat message, and try one "deep" research query — confirm the deep query completes without hitting a Vercel timeout (if it does time out, see the design spec's "Deep-mode timeout risk" fallback: raise `maxDuration` further, up to 300s under Fluid Compute).

- [ ] **Step 7: Leave the old infrastructure alone**

Per the design spec: don't delete the `langchain-autonomous-agent` repo or the paused Hugging Face Space. Leave the Space paused as a fallback until this deployment has been stable for a while.

---

## Self-Review Notes

- **Spec coverage:** Architecture (Task 1–2, 4), request flow/config (Task 4–5), error handling (unchanged — verified no code touches `get_agent()`'s error path), testing (Task 3, 6), migration steps (Tasks 1–6 map 1:1 to the spec's 7-step list, with the `/health` → `/api/health` rename added as a necessary routing detail the spec didn't spell out but doesn't contradict).
- **Placeholder scan:** no TBD/TODO; the one open-ended item (Fluid Compute dashboard toggle) is flagged explicitly as a manual verification step, not left vague.
- **Type/name consistency:** `API_BASE_URL` name unchanged across Task 5; `app` variable name required by Vercel and preserved from the original `api.py`; route paths (`/api/health`, `/api/chat`, `/api/research`) consistent between Task 2 (backend) and Task 5 (frontend callers).
