# Résumé ↔ Job Fit Analyzer — Frontend

A modern React + TypeScript single-page app that scores how well a résumé fits
one or more job descriptions, surfaces skill gaps, rewrites bullet points, and
offers free in-browser résumé tools. It talks to the project's FastAPI backend
for the AI features and does everything else client-side.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS v3** (design system: indigo/violet accent on a slate neutral scale)
- **recharts** — fit-score comparison chart
- **pdfjs-dist** — client-side PDF text extraction
- **lucide-react** — icons

## Prerequisites

- Node.js 18+ and npm
- The FastAPI backend running (default `http://localhost:8000`) for the two
  AI-powered features. The free tools work with no backend.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Configuration

The backend base URL is read from the Vite env var `VITE_API_BASE`. A `.env`
file is included with the default:

```
VITE_API_BASE=http://localhost:8000
```

Change it to point at a deployed backend if needed, then restart `npm run dev`.

## OpenAI API key

The two AI features (**AI Analysis** and **Rewrite Bullet**) require your own
OpenAI API key. Enter it via the **API key** button in the top-right header.

- It is stored only in your browser's `localStorage`.
- It is sent only to the backend's paid endpoints, in the `X-OpenAI-Key` header.
- It is never hardcoded and never persisted server-side.

## Features

### AI-powered (spend your OpenAI credit — clearly badged)
- **AI Analysis** → `POST /analyze-fit`: per-job fit score (1–10, color-coded),
  matching skills, gap skills, suggested tweaks, a recharts comparison bar chart,
  and CSV export.
- **Rewrite Bullet** → `POST /rewrite-bullet`: 2–3 tailored rewrites of a single
  bullet against a chosen (or pasted) job description, each with a "what changed"
  note.

### Free (100% client-side — no API, no cost)
- **Keyword match score** — TF-IDF cosine similarity between résumé and each job.
- **Word cloud** — top ~40 weighted words from a selected job description.
- **ATS checklist** — rule-based checks (length, email, phone, sections, bullets).

## Backend contract

- `POST /analyze-fit` — `{ resume_text, jobs: [{ title, description }] }`
  → `{ results: [{ job_title, fit_score, matching_skills, missing_skills, suggested_tweaks }] }`
- `POST /rewrite-bullet` — `{ bullet_text, job_title, job_description }`
  → `{ job_title, rewrites: [{ rewrite, note }] }`
- `GET /health` → `{ status: "ok" }` (shown as a live status pill in the header)

Non-200 responses return `{ "detail": "..." }`, which the UI surfaces in an
error banner.

## Scripts

```bash
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
```

## Project structure

```
src/
  api.ts                 # typed fetch client (base URL + X-OpenAI-Key)
  types.ts               # request/response + domain types
  App.tsx                # layout, tabs, analysis orchestration
  main.tsx
  index.css              # Tailwind entry + base styles
  lib/
    cn.ts                # clsx + tailwind-merge helper
    pdf.ts               # pdfjs-dist text extraction
    freeTools.ts         # keyword score, word cloud, ATS checklist
    score.ts             # score -> color/style mapping
    useLocalStorage.ts   # persisted API key hook
  components/
    Header.tsx  BackendStatus.tsx  ApiKeyField.tsx
    ResumeInput.tsx  JobList.tsx
    AnalysisResults.tsx  FitScoreChart.tsx  RewriteTool.tsx
    FreeTools.tsx
    ui/  Card, Badge, Button, Spinner, Banners, FeatureBadges
```
