# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A resume ↔ job-fit analyzer, split into three services:

1. **FastAPI backend** ([backend/main.py](backend/main.py)) — owns all OpenAI calls (`/analyze-fit`, `/rewrite-bullet`).
2. **Streamlit app** ([resume_job_matcher.py](resume_job_matcher.py)) — the original single-file UI; now calls the backend over HTTP for AI features, and still runs the "Free Tools" locally.
3. **React frontend** ([frontend/](frontend/)) — a modern SaaS-style UI (Vite + React + TypeScript + Tailwind v3) that also calls the backend; Free Tools are reimplemented client-side in JS.

Both frontends are interchangeable clients of the same backend. The Streamlit app is the deployed/production surface; the React app is the newer, richer client.

## The API contract (the spine of the whole repo)

All three services must agree on this. If you change a request/response shape, update **backend + both frontends** together.

- **`GET /health`** → `{"status": "ok"}`
- **`POST /analyze-fit`** — body `{"resume_text": str, "jobs": [{"title": str, "description": str}]}` → `{"results": [{"job_title": str, "fit_score": int|null, "matching_skills": [str], "missing_skills": [str], "suggested_tweaks": [str]}]}`. Empty-description jobs are skipped (order preserved); blank titles default to `Job N`.
- **`POST /rewrite-bullet`** — body `{"bullet_text": str, "job_title": str, "job_description": str}` → `{"job_title": str, "rewrites": [{"rewrite": str, "note": str}]}` (2-3 rewrites).

**API key flow (bring-your-own-key):** the user's OpenAI key is entered in the frontend and sent to the backend in the **`X-OpenAI-Key`** header. The backend falls back to the `OPENAI_API_KEY` env var if the header is absent, and returns **400** if neither is present. The key is never persisted server-side; the React app keeps it in `localStorage` only. Missing/empty required fields → 400; malformed bodies → 422 (Pydantic); OpenAI SDK failures → 502 with `{"detail": ...}`.

## Running everything

Use the project virtualenv for the Python pieces — **not** Anaconda (see gotcha below).

```bash
# 1. Backend (owns OpenAI) — http://localhost:8000, docs at /docs
source venv/bin/activate
pip install -r backend/requirements.txt   # first time only
uvicorn backend.main:app --reload --port 8000

# 2a. Streamlit client — http://localhost:8501
source venv/bin/activate
streamlit run resume_job_matcher.py

# 2b. React client — http://localhost:5173
cd frontend && npm install && npm run dev
```

Both clients target `http://localhost:8000` by default. Override with the `BACKEND_URL` env var (Streamlit) or `VITE_API_BASE` in `frontend/.env` (React).

**No test suite or linter.** Sanity checks: `python -m py_compile backend/main.py resume_job_matcher.py` for the Python side, and `cd frontend && npm run build` (runs `tsc -b && vite build`) for the React side.

**Environment gotcha (recurring):** if `streamlit`/`uvicorn` resolves to Anaconda's Python (`/opt/anaconda3/...`), the Python services die with `ModuleNotFoundError` because deps are only installed in `venv/`. Confirm `which streamlit` / `which uvicorn` point inside `venv/` first. Conda's `base` auto-activation has been disabled globally (`conda config --set auto_activate_base false`) to stop it shadowing the venv on `PATH`.

## Deployment

The Streamlit app is deployed on Streamlit Community Cloud at `ai-resume-job-fit.streamlit.app`, redeploying automatically from `main` — pushing to `main` publishes to production, no staging. **Note:** the deployed Streamlit app now expects a reachable backend (`BACKEND_URL`); deploying the FastAPI backend somewhere and pointing `BACKEND_URL` at it is a prerequisite for the AI features to work in production. The React frontend has no deploy target configured yet.

## Architecture notes

### The shared AI-call pattern (backend)
Both AI endpoints follow one contract — build `OpenAI(api_key=...)`, call `client.responses.create(model="gpt-4o", instructions=system_instructions, input=prompt)` where `system_instructions` demand a single raw JSON object, then defensively strip ```` ``` ```` fences and `json.loads` with a fallback dict on `JSONDecodeError`. **When adding a new AI feature, add it to the backend and replicate this exact pattern** (structured JSON out, fence cleanup, parse-failure fallback) rather than inventing a new one. Do not reintroduce direct OpenAI calls in the frontends.

### Free tools live in BOTH frontends, locally (no backend, no cost)
Kept deliberately separate so users can avoid API costs. Each frontend implements them natively:
- Streamlit: `compute_keyword_score()` (TF-IDF cosine via scikit-learn), `generate_wordcloud_image()` (wordcloud lib), `run_ats_checklist()` (regex rules).
- React: `src/lib/freeTools.ts` ports the same three — TF-IDF cosine keyword score, a word-frequency cloud, and the ATS checklist. **If you change a free-tool's logic, change it in both places** to keep parity.

### Streamlit state conventions
- `st.session_state.jobs` is the shared list of `{"title", "description"}` dicts; both AI-using tabs consume `valid_jobs = [j for j in st.session_state.jobs if j["description"].strip()]`. Reuse this rather than adding a parallel job input.
- Each tab persists output in its own session key (`results`, `free_results`, `rewrite_result`) so results survive reruns.
- `analyze_fit()` / `rewrite_bullet()` keep their original signatures and return shapes (so the UI code is unchanged) but now POST to the backend and unwrap the response; on connection/HTTP errors they return the same-shaped fallback dict and call `st.error`.

### React frontend structure ([frontend/](frontend/))
`src/api.ts` is the typed fetch client (base URL + `X-OpenAI-Key` header, surfaces `{detail}` errors); `src/types.ts` mirrors the contract above. Components under `src/components/` (`ResumeInput`, `JobList`, `AnalysisResults`, `FitScoreChart`, `RewriteTool`, `FreeTools`, plus `ui/` primitives). PDF text is extracted client-side via `pdfjs-dist`. The paid-vs-free distinction is a hard visual rule — AI sections carry a "Uses your OpenAI credit" pill, Free Tools carry a "Free · runs in your browser" pill; preserve this when editing the UI.
