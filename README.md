# Gray Matter Research Agent

AI research workspace for scientific articles, web research, Wikipedia lookup, and computational reasoning.

## Description

**Gray Matter LABS** is a modern research chat interface inspired by chemistry labs and precision science. The Heisenberg Research Agent orchestrates ArXiv paper discovery, Wikipedia knowledge, live web search, and scientific calculations — with a premium dark-lab aesthetic.

## Stack

- React + Vite
- arXiv API (`export.arxiv.org`)
- Wikipedia REST API
- DuckDuckGo Instant Answer API
- Scientific calculator (client-side)
- LangChain agent backend (Hugging Face Spaces)

## Features

- Chat-based research workflow with conversation history
- Intelligent tool routing (ArXiv / Wikipedia / Web / Calculator / Agent)
- Scientific paper discovery with result cards
- Wikipedia and web lookup with structured snippets
- Calculation support with step display
- Lab-inspired three-panel interface (sidebar · chat · tools)
- API health monitoring

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`

## Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | LangChain agent backend | `https://salmeida-langchain-agent.hf.space` |

## API endpoints (backend)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/api/chat` | POST | Multi-turn research queries |

## Project structure

```
src/
  components/     UI (Sidebar, ChatWindow, LabToolsPanel, etc.)
  services/       arXiv, Wikipedia, web, calculator, research agent
  utils/          tool routing, message formatters
  data/           sample conversations and suggestions
  styles/         global lab theme
old-research-agent/   Legacy reference (logic source)
```

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run generate:icons` — regenerate PNG favicons from `public/favicon.svg` (ImageMagick)

## Deploy on Vercel

This project is a **Vite + React** static SPA. Vercel auto-detects the stack via `vercel.json`.

### One-click

1. Push the repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Leave **Framework Preset** as Vite (or auto).
4. Add environment variable:
   - `VITE_API_BASE_URL` → your LangChain agent URL (default: `https://salmeida-langchain-agent.hf.space`)
5. Deploy.

### CLI

```bash
npm i -g vercel
vercel
# follow prompts; set VITE_API_BASE_URL in project settings
vercel --prod
```

### What’s included

| File | Purpose |
|------|---------|
| `vercel.json` | Build output `dist/`, SPA rewrites, cache headers |
| `public/favicon.svg` | Vector favicon (87 / Gm) |
| `public/favicon.ico` | Legacy browsers |
| `public/apple-touch-icon.png` | iOS home screen |
| `public/android-chrome-*.png` | PWA / Android |
| `public/site.webmanifest` | Installable app metadata |
| `public/og-image.png` | Open Graph / Twitter preview |

Client-side routes fall back to `index.html` so deep links work after refresh.

## License

See repository license. Legacy reference in `old-research-agent/` was GPL-3.0.
