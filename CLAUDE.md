# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Streamlit web app ([resume_job_matcher.py](resume_job_matcher.py)) that scores how well a resume fits one or more job descriptions, and offers resume-tailoring tools. All application code lives in that one file; `requirements.txt` is the only dependency manifest.

## Running the app

Use the project virtualenv — **not** Anaconda:

```bash
source venv/bin/activate
streamlit run resume_job_matcher.py
```

There is no test suite, linter, or build step. To sanity-check a change compiles: `python -m py_compile resume_job_matcher.py`.

**Environment gotcha (recurring):** if `streamlit` resolves to Anaconda's Python (`/opt/anaconda3/...`), the app dies with `ModuleNotFoundError: No module named 'openai'` because the project's deps are only installed in `venv/`. Confirm `which streamlit` points inside `venv/` before running. Conda's `base` auto-activation has been disabled globally (`conda config --set auto_activate_base false`) to prevent it from shadowing the venv on `PATH`.

## Deployment

Deployed on Streamlit Community Cloud at `ai-resume-job-fit.streamlit.app`, which redeploys automatically from the `main` branch. Pushing to `main` publishes to production — there is no separate staging.

## Architecture

The app has two distinct classes of functionality, kept deliberately separate so users can avoid API costs:

1. **OpenAI-backed helpers** (cost the user's own credit): `analyze_fit()` and `rewrite_bullet()`. Every such helper follows the same contract — build `OpenAI(api_key=openai_api_key)`, call `client.responses.create(model="gpt-4o", instructions=..., input=...)` with `system_instructions` that demand a single raw JSON object, then defensively strip ```` ``` ```` fences and `json.loads` the result with a fallback dict on `JSONDecodeError`. **When adding a new AI feature, replicate this exact pattern** (structured JSON out, fence cleanup, parse-failure fallback) rather than inventing a new one.

2. **Local free helpers** (no API, no cost): `compute_keyword_score()` (TF-IDF cosine similarity), `generate_wordcloud_image()`, and `run_ats_checklist()` (rule-based regex checks).

### UI structure

Input sections (resume upload/paste, then a dynamic list of job descriptions) feed three `st.tabs`:
- **🤖 AI-Powered Analysis** — runs `analyze_fit()` per job, charts fit scores, offers CSV export.
- **🆓 Free Tools** — the local helpers above.
- **✏️ Rewrite a Bullet Point** — runs `rewrite_bullet()` on a single bullet against a chosen job.

### State conventions

- Jobs are the shared input: `st.session_state.jobs` is a list of `{"title", "description"}` dicts. Both the AI and rewrite tabs consume `valid_jobs = [j for j in st.session_state.jobs if j["description"].strip()]`. New features that target "a job" should reuse this rather than adding a parallel input.
- Each tab persists its output in its own session key (`results`, `free_results`, `rewrite_result`) so results survive Streamlit reruns.
- The OpenAI API key is entered in the sidebar at runtime and passed straight to the client — it is never persisted, and there is no `.env` or secrets file.
