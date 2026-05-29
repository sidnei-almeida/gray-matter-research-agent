<p align="center">
  <img src="./images/header.png" alt="Gray Matter LABS — Research Agent" width="920" />
</p>

<h1 align="center">Gray Matter LABS</h1>

<p align="center">
  <strong>React · Vite · LangChain Agent · ArXiv · Wikipedia · Live Web</strong><br />
  <em>A precision research chat workspace with a dark-lab aesthetic and multi-session notebooks.</em>
</p>

<p align="center">
  <a href="https://github.com/sidnei-almeida/gray-matter-research-agent"><strong>View on GitHub</strong></a>
  &nbsp;·&nbsp;
  <a href="https://salmeida-langchain-agent.hf.space">Agent API (Hugging Face)</a>
  &nbsp;·&nbsp;
  <a href="#deploy-on-vercel">Deploy on Vercel</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Lucide-Icons-F56565?logo=lucide&logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/Markdown-GFM-000000?logo=markdown&logoColor=white" alt="Markdown GFM" />
  <img src="https://img.shields.io/badge/Agent-LangChain-1C3C3C?logo=langchain&logoColor=white" alt="LangChain" />
  <img src="https://img.shields.io/badge/Storage-localStorage-97C455" alt="localStorage" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white" alt="Vercel" />
</p>

---

## What this is

**Gray Matter LABS** is a modern research chat interface inspired by chemistry labs and precision science. The **Heisenberg Research Agent** helps you explore scientific literature, structured knowledge, live web signals, and calculations — inside a three-panel workspace designed for long research sessions.

The frontend owns **conversation state** (titles, messages, active session) and persists everything in **localStorage**. The backend stays **stateless**: each request carries recent context; the API does not manage sessions.

> **Production agent:** `https://salmeida-langchain-agent.hf.space` — override with `VITE_API_BASE_URL` if you host your own Space.

---

## Layout & workflow

| Zone | Role |
|------|------|
| **Sidebar** | Session list grouped by date, New Chat, delete with lab-themed confirm dialog |
| **Chat workspace** | Agent intro, message thread, composer with shortcuts |
| **Lab Tools panel** | ArXiv · Wikipedia · Live Web · Calculator cards, suggested prompts, Lab Vitals |

```mermaid
flowchart LR
  USER[Researcher]
  UI[Gray Matter LABS UI]
  LS[(localStorage)]
  API[LangChain Agent API]
  ARXIV[arXiv API]
  WIKI[Wikipedia REST]
  WEB[DuckDuckGo IA]

  USER --> UI
  UI <--> LS
  UI --> API
  UI -.-> ARXIV
  UI -.-> WIKI
  UI -.-> WEB
```

---

## Main features

### Multi-session research notebook

- **New Chat** — creates a session with a welcome message from the agent
- **Auto-title** — first user message renames sessions still titled *New Research Session* (max 42 characters)
- **Persist on refresh** — conversations and active session survive browser reloads
- **Delete session** — custom lab dialog (no native `window.confirm`); safe fallback when deleting the last session

### Chat & agent

- User / assistant bubbles with loading and error states
- Last **8 messages** sent as `conversationHistory` to the agent (API-ready, backend may ignore until wired)
- **Research Agent** via `POST /api/chat` with graceful mock fallback when the API is unreachable
- Suggested prompts and composer shortcuts for faster input

### Lab tools (UI)

| Tool | Capability |
|------|------------|
| **ArXiv** | Preprint and paper discovery (`export.arxiv.org`) |
| **Wikipedia** | REST knowledge lookups |
| **Live Web** | DuckDuckGo Instant Answer (no API key) |
| **Scientific Calculations** | Client-side math via Math.js |

Tool routing and dedicated service modules live under `src/services/` for the next integration phase.

### Experience polish

- Dark lab theme — green accent, glass panels, periodic **87 / Gm** branding
- Themed scrollbars, selection, and focus rings (no default browser chrome clash)
- PWA-friendly manifest, favicons, and Open Graph image for sharing
- **Lab Vitals** and **Suggested Prompts** panels for atmosphere and quick starts

---

## Design system

Built for focused research: low-glare dark base, toxic green highlights, and monospace data where it matters.

| Element | Implementation |
|---------|----------------|
| **Typography** | IBM Plex Sans (UI) + IBM Plex Mono (labels, vitals) via Google Fonts |
| **Surfaces** | `--bg-panel` / `--bg-card` with subtle green borders |
| **Accent** | `--accent-green` · `--accent-toxic` on CTAs and active session |
| **Logo** | Periodic-table **87 / Gm** mark in sidebar and favicons |
| **Dialogs** | `LabConfirmDialog` — discard session flow matches lab palette |
| **Background** | Full-bleed lab imagery with dark green overlay |

Tokens: `src/styles/tokens.css`, `global.css`, `layout.css`, `native-theme.css`, `lab-dialog.css`.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + Vite 6 |
| Icons | Lucide React |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| Charts | Recharts (Lab Vitals) |
| Math | Math.js |
| State | React hooks + `localStorage` (no Redux) |
| Agent API | LangChain backend on Hugging Face Spaces |
| Deploy | Vercel (static SPA, `vercel.json`) |

---

## Environment

Create `.env` from the example (all variables are **public** — no secrets):

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | LangChain agent backend | `https://salmeida-langchain-agent.hf.space` |
| `VITE_APP_NAME` | Display name (reserved) | `Gray Matter LABS` |
| `VITE_ARXIV_API_URL` | arXiv query endpoint (reserved) | `https://export.arxiv.org/api/query` |
| `VITE_WIKIPEDIA_API_URL` | Wikipedia REST (reserved) | `https://en.wikipedia.org/api/rest_v1` |
| `VITE_WEB_SEARCH_API_URL` | DuckDuckGo IA (reserved) | `https://api.duckduckgo.com/` |

Only **`VITE_API_BASE_URL`** is read by the app today. Others are documented for upcoming service wiring.

On **Vercel**, set `VITE_API_BASE_URL` only if you use a non-default agent URL, then **redeploy** (Vite inlines env at build time).

---

## Quick start

```bash
git clone https://github.com/sidnei-almeida/gray-matter-research-agent.git
cd gray-matter-research-agent

npm install
cp .env.example .env   # optional — defaults work out of the box

npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production build

```bash
npm run build
npm run preview
```

### Regenerate favicons

Requires [ImageMagick](https://imagemagick.org/):

```bash
npm run generate:icons
```

---

## Deploy on Vercel

1. Import this repository on [Vercel](https://vercel.com/new).
2. Framework preset: **Vite** (or auto from `vercel.json`).
3. Optional environment variable:
   - `VITE_API_BASE_URL` = your Hugging Face Space URL
4. Deploy.

```bash
npm i -g vercel
vercel
vercel --prod
```

| Asset / config | Purpose |
|----------------|---------|
| `vercel.json` | Build `dist/`, SPA rewrites, cache headers |
| `public/site.webmanifest` | Installable PWA metadata |
| `public/favicon.svg` · PNG set | Browser and mobile icons |
| `public/og-image.png` | Social preview |

---

## Repository structure

```
gray-matter-research-agent/
├── images/
│   └── header.png                 # README hero banner
├── public/                        # Static assets (favicons, manifest, og-image)
├── src/
│   ├── components/                # Sidebar, ChatWorkspace, LabToolsPanel, dialogs, …
│   ├── context/                   # LabDialogProvider (confirm flows)
│   ├── hooks/                     # useConversations (sessions + persistence)
│   ├── services/                  # API client, arXiv, Wikipedia, web, calculator, agent
│   ├── utils/                     # IDs, titles, date groups, tool routing
│   ├── styles/                    # Lab theme tokens and layout
│   └── data/                      # Suggested prompts, lab tools metadata
├── old-research-agent/            # Legacy HTML reference (GPL-3.0), local only
├── vercel.json
├── .env.example
└── index.html
```

---

## API surface (agent backend)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/api/chat` | POST | Multi-turn research queries |

The UI sends recent message history when the backend supports it. Session IDs are **not** required on the server.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run generate:icons` | Regenerate PNG favicons from `public/favicon.svg` |

---

## Roadmap

- Wire ArXiv / Wikipedia / Web / Calculator into the live chat routing
- Optional Node.js + SQLite backend for server-side sessions
- Auth and cloud sync (out of scope for current MVP)

---

## Disclaimer

Agent responses, tool outputs, and third-party API data are for **research assistance and demonstration only**. They are not medical, legal, or investment advice. Always verify claims against primary sources.

---

## License & author

See repository license. Legacy reference in `old-research-agent/` is **GPL-3.0**.

**Sidnei Alves de Almeida** — [@sidnei-almeida](https://github.com/sidnei-almeida)
