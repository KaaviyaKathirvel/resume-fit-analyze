# Resume ↔ Job Fit Analyzer — FastAPI backend

A FastAPI service that exposes the OpenAI-backed logic from the Streamlit app
(`analyze_fit` and `rewrite_bullet`) as HTTP endpoints. The prompts, model
(`gpt-4o`), code-fence stripping, and JSON parse/fallback behavior mirror the
original app.

## Install

From the repo root:

```bash
pip install -r backend/requirements.txt
```

## Run

From the repo root:

```bash
uvicorn backend.main:app --reload --port 8000
```

Or from inside `backend/`:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Interactive OpenAPI docs are then available at http://localhost:8000/docs.

## OpenAI API key

Every request that calls OpenAI resolves the key in this order:

1. The `X-OpenAI-Key` request header.
2. The `OPENAI_API_KEY` environment variable (fallback).

If neither is present the endpoint returns **HTTP 400**:

```json
{"detail": "OpenAI API key not provided. Send it in the X-OpenAI-Key header or set OPENAI_API_KEY."}
```

The client is built per-request as `OpenAI(api_key=<resolved key>)`; the key is
never persisted.

## Endpoints

### `GET /health`

Returns `{"status": "ok"}`.

### `POST /analyze-fit`

Request:

```json
{
  "resume_text": "…full resume text…",
  "jobs": [
    {"title": "Data Analyst @ Acme", "description": "…job description…"}
  ]
}
```

Jobs with an empty `description` are skipped; input order is preserved. A blank
`title` defaults to `"Job N"` (1-indexed among the non-empty jobs).

Response:

```json
{
  "results": [
    {
      "job_title": "Data Analyst @ Acme",
      "fit_score": 8,
      "matching_skills": ["…"],
      "missing_skills": ["…"],
      "suggested_tweaks": ["…"]
    }
  ]
}
```

`fit_score` is `null` when the model response could not be parsed as JSON.

### `POST /rewrite-bullet`

Request:

```json
{
  "bullet_text": "Built internal dashboards for the sales team using SQL and Excel",
  "job_title": "Data Analyst @ Acme",
  "job_description": "…job description…"
}
```

`job_title` is optional and defaults to `"Target job"`.

Response:

```json
{
  "job_title": "Data Analyst @ Acme",
  "rewrites": [
    {"rewrite": "…", "note": "…"}
  ]
}
```

Returns 2-3 rewrite variants.

## Error handling

| Situation | Status |
| --- | --- |
| Missing OpenAI key | 400 |
| Empty `resume_text` / `bullet_text` / `job_description` | 400 |
| Invalid request body (schema) | 422 (FastAPI/Pydantic) |
| OpenAI SDK raises (auth, network, etc.) | 502 — `{"detail": "OpenAI request failed: <message>"}` |
