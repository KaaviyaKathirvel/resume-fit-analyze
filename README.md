# Resume ↔ Job Fit Analyzer

Paste your resume and one or more job descriptions, and get an AI-scored fit
analysis for each role — a 1–10 fit score, matching and missing skills, and
concrete, actionable resume tweaks. You can also rewrite a single resume bullet
to better target a specific job.

Alongside the AI features, a set of **free tools run entirely in your browser
or on your machine** — no OpenAI key, no cost — for a quick keyword-match
estimate, a job-description word cloud, and a basic ATS-friendliness checklist.

The project is split into three services around a single shared API:

| Service | Path | Role |
| --- | --- | --- |
| **FastAPI backend** | [backend/](backend/) | Owns all OpenAI calls (`/analyze-fit`, `/rewrite-bullet`). |
| **Streamlit app** | [resume_job_matcher.py](resume_job_matcher.py) | Original single-file UI; the deployed/production surface. |
| **React frontend** | [frontend/](frontend/) | Modern SaaS-style client (Vite + React + TypeScript + Tailwind). |

Both frontends are interchangeable clients of the same backend. The Streamlit
app is deployed to production; the React app is the newer, richer client.

## Free vs. paid features

The distinction is deliberate — you can use the free tools without ever
providing an API key.

**Uses your OpenAI credit** (requires an API key; billed to *your* OpenAI
account, typically a cent or two per job):

- **AI fit analysis** — fit score, matching/missing skills, suggested tweaks.
- **Bullet rewrite** — 2–3 tailored rewrites of a single resume bullet.

**Free — no API key, no cost** (runs locally / in your browser):

- **Keyword match score** — a rough fit estimate via TF-IDF cosine similarity.
- **Job-description word cloud** — the most prominent terms in a posting.
- **ATS checklist** — rule-based checks (length, contact info, standard
  sections, bullet points).

### Bring-your-own-key

The AI features use *your* OpenAI API key. Enter it in the frontend; it is sent
to the backend in the `X-OpenAI-Key` header and **never persisted server-side**.
The backend falls back to the `OPENAI_API_KEY` environment variable if the
header is absent. The React app keeps the key in `localStorage` only.

Get a key at
[platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)
with billing enabled.

## Prerequisites

- **Python 3.10+** with a project virtualenv (see the environment note below).
- **Node.js 18+** and npm (for the React frontend).
- An **OpenAI API key** — only needed for the AI features.

## Install & run

Run the **backend** first — both frontends depend on it for the AI features.

> **Environment note:** use the project virtualenv (`venv/`) for the Python
> pieces, **not** Anaconda. If `uvicorn`/`streamlit` resolve to Anaconda's
> Python, the services die with `ModuleNotFoundError` because the deps are only
> installed in `venv/`. Confirm `which uvicorn` / `which streamlit` point inside
> `venv/` first.

### 1. Backend (FastAPI) — http://localhost:8000

Owns the OpenAI calls; interactive API docs at `/docs`.

```bash
source venv/bin/activate
pip install -r backend/requirements.txt   # first time only
uvicorn backend.main:app --reload --port 8000
```

### 2a. Streamlit frontend — http://localhost:8501

```bash
source venv/bin/activate
pip install -r requirements.txt           # first time only
streamlit run resume_job_matcher.py
```

### 2b. React frontend — http://localhost:5173

```bash
cd frontend
npm install                               # first time only
npm run dev
```

Both frontends target `http://localhost:8000` by default. Override with:

- **Streamlit:** the `BACKEND_URL` environment variable.
- **React:** `VITE_API_BASE` in [frontend/.env](frontend/.env).

## API contract

All three services agree on these endpoints. If you change a request/response
shape, update the backend **and both frontends** together.

- **`GET /health`** → `{"status": "ok"}`
- **`POST /analyze-fit`** — `{"resume_text": str, "jobs": [{"title", "description"}]}`
  → `{"results": [{"job_title", "fit_score", "matching_skills",
  "missing_skills", "suggested_tweaks"}]}`. Empty-description jobs are skipped
  (order preserved); blank titles default to `Job N`.
- **`POST /rewrite-bullet`** — `{"bullet_text", "job_title", "job_description"}`
  → `{"job_title", "rewrites": [{"rewrite", "note"}]}` (2–3 rewrites).

**Errors:** missing/empty required fields → `400`; malformed bodies → `422`
(Pydantic); missing API key → `400`; OpenAI SDK failures → `502` with
`{"detail": ...}`.

## Project structure

```
resume-fit-analyzer/
├── README.md                 # this file
├── CLAUDE.md                 # architecture & dev guidance
├── requirements.txt          # Streamlit app dependencies
├── resume_job_matcher.py     # Streamlit app (original single-file UI)
│
├── backend/                  # FastAPI backend — owns all OpenAI calls
│   ├── main.py               #   endpoints + shared AI-call pattern
│   ├── requirements.txt      #   backend dependencies
│   └── README.md
│
└── frontend/                 # React client (Vite + TS + Tailwind v3)
    ├── src/
    │   ├── api.ts            #   typed fetch client (X-OpenAI-Key header)
    │   ├── types.ts          #   mirrors the API contract
    │   ├── components/       #   ResumeInput, JobList, AnalysisResults, …
    │   └── lib/
    │       ├── freeTools.ts  #   free tools reimplemented client-side
    │       └── pdf.ts        #   client-side PDF text extraction
    ├── .env                  #   VITE_API_BASE
    └── README.md
```

The free tools are implemented **natively in each frontend** (Python via
scikit-learn/wordcloud in Streamlit; JavaScript in
[frontend/src/lib/freeTools.ts](frontend/src/lib/freeTools.ts)) so they cost
nothing to run. If you change a free tool's logic, change it in both places to
keep parity.

## Sanity checks

There is no test suite or linter. To verify things still build:

```bash
# Python
python -m py_compile backend/main.py resume_job_matcher.py

# React
cd frontend && npm run build   # runs tsc -b && vite build
```

## Deployment

The Streamlit app is deployed on Streamlit Community Cloud at
`ai-resume-job-fit.streamlit.app`, redeploying automatically from `main`. The
deployed app now expects a **reachable backend** (`BACKEND_URL`), so deploying
the FastAPI backend and pointing `BACKEND_URL` at it is a prerequisite for the
AI features to work in production. The React frontend has no deploy target
configured yet.
