"""FastAPI backend for the Resume ↔ Job Fit Analyzer.

Extracts the OpenAI-backed logic (`analyze_fit`, `rewrite_bullet`) from the
Streamlit app into HTTP endpoints. The prompts, system instructions, model,
code-fence stripping, and JSON parse/fallback behavior are preserved exactly
from the original app (with one intentional change: rewrite now asks for 2-3
variants instead of 1-2).
"""

import json
import os
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

app = FastAPI(
    title="Resume ↔ Job Fit Analyzer API",
    description=(
        "OpenAI-backed endpoints for analyzing resume/job fit and rewriting "
        "resume bullet points."
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    # Explicit dev origins plus a wildcard so local frontends work out of the box.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class JobInput(BaseModel):
    title: str = ""
    description: str = ""


class AnalyzeFitRequest(BaseModel):
    resume_text: str = Field(..., description="The full resume text.")
    jobs: List[JobInput] = Field(..., description="Jobs to compare the resume against.")


class JobResult(BaseModel):
    job_title: str
    fit_score: Optional[int]
    matching_skills: List[str]
    missing_skills: List[str]
    suggested_tweaks: List[str]


class AnalyzeFitResponse(BaseModel):
    results: List[JobResult]


class RewriteBulletRequest(BaseModel):
    bullet_text: str = Field(..., description="A single resume bullet point.")
    job_title: str = Field("Target job", description="Label for the target job.")
    job_description: str = Field(..., description="The target job description.")


class RewriteItem(BaseModel):
    rewrite: str
    note: str


class RewriteBulletResponse(BaseModel):
    job_title: str
    rewrites: List[RewriteItem]


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
SYSTEM_INSTRUCTIONS = (
    "You are a helpful, precise career coach and technical recruiter. "
    "You always respond with a single valid JSON object and nothing else - "
    "no markdown fences, no commentary."
)


def _resolve_api_key(header_key: Optional[str]) -> str:
    """Resolve the OpenAI API key from the request header or environment.

    Args:
        header_key: Value of the ``X-OpenAI-Key`` request header, if present.

    Returns:
        The resolved OpenAI API key.

    Raises:
        HTTPException: 400 if no key is found in the header or the
            ``OPENAI_API_KEY`` environment variable.
    """
    key = header_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=400,
            detail=(
                "OpenAI API key not provided. Send it in the X-OpenAI-Key header "
                "or set OPENAI_API_KEY."
            ),
        )
    return key


def _strip_code_fences(raw: str) -> str:
    """Strip Markdown code fences from a model response.

    Defensive cleanup for cases where the model wraps its JSON output in
    ``` fences despite being instructed not to.

    Args:
        raw: The raw text returned by the model.

    Returns:
        The text with surrounding code fences and an optional leading
        ``json`` language tag removed.
    """
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return raw


def _run_openai(client: OpenAI, prompt: str) -> str:
    """Call the OpenAI Responses API and return the raw output text.

    Args:
        client: An initialized OpenAI client.
        prompt: The user prompt to send to the model.

    Returns:
        The model's raw output text.

    Raises:
        HTTPException: 502 if the OpenAI SDK call fails.
    """
    try:
        response = client.responses.create(
            model="gpt-4o",
            instructions=SYSTEM_INSTRUCTIONS,
            input=prompt,
        )
    except Exception as exc:  # noqa: BLE001 - surface any SDK failure as a 502
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI request failed: {exc}",
        )
    return response.output_text


# ---------------------------------------------------------------------------
# Core logic (mirrors the original Streamlit helpers)
# ---------------------------------------------------------------------------
def analyze_fit(client: OpenAI, resume_text: str, job_title: str, job_description: str) -> dict:
    """Score a resume against a single job description using OpenAI.

    Prompts the model for a structured fit analysis, strips any code
    fences, and parses the JSON response, falling back to an empty result
    if parsing fails.

    Args:
        client: An initialized OpenAI client.
        resume_text: The full resume text.
        job_title: Label for the target job; attached to the result.
        job_description: The target job description.

    Returns:
        A dict with ``fit_score`` (int or None), ``matching_skills``,
        ``missing_skills``, ``suggested_tweaks``, and ``job_title``.
    """
    prompt = f"""
Compare the RESUME below against the JOB DESCRIPTION below.

Return ONLY a JSON object with exactly these keys:
- "fit_score": an integer from 1 to 10 (10 = excellent fit)
- "matching_skills": a list of up to 8 short strings — skills/experience from the resume that align with the job
- "missing_skills": a list of up to 6 short strings — skills/requirements in the job description not evidenced in the resume
- "suggested_tweaks": a list of 3-5 short, concrete, actionable suggestions for tailoring this resume to this specific job (e.g. "Add a bullet quantifying your SQL reporting work under the Analyst role")

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}
"""

    raw = _strip_code_fences(_run_openai(client, prompt))

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "fit_score": None,
            "matching_skills": [],
            "missing_skills": [],
            "suggested_tweaks": [f"Could not parse model response: {raw[:200]}"],
        }

    parsed["job_title"] = job_title
    return parsed


def rewrite_bullet(client: OpenAI, bullet_text: str, job_title: str, job_description: str) -> dict:
    """Rewrite a resume bullet to better target a specific job using OpenAI.

    Prompts the model for 2-3 tailored rewrites, strips any code fences,
    and parses the JSON response, falling back to the original bullet if
    parsing fails.

    Args:
        client: An initialized OpenAI client.
        bullet_text: The single resume bullet point to rewrite.
        job_title: Label for the target job; attached to the result.
        job_description: The target job description.

    Returns:
        A dict with ``rewrites`` (a list of ``{"rewrite", "note"}`` objects)
        and ``job_title``.
    """
    prompt = f"""
Rewrite the RESUME BULLET below so it is more relevant and compelling for the JOB DESCRIPTION below.

Return ONLY a JSON object with exactly this key:
- "rewrites": a list of 2-3 objects, each with:
    - "rewrite": a single rewritten version of the bullet — one line, led with a strong action verb, quantified where reasonable, and tailored to this job. Do not invent facts not implied by the original bullet.
    - "note": a short one-line explanation of what changed and why it's a better fit for this specific job

RESUME BULLET:
{bullet_text}

JOB DESCRIPTION:
{job_description}
"""

    raw = _strip_code_fences(_run_openai(client, prompt))

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "rewrites": [
                {"rewrite": raw[:300], "note": "Could not parse model response as JSON."}
            ],
        }

    parsed["job_title"] = job_title
    return parsed


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    """Health-check endpoint.

    Returns:
        A dict ``{"status": "ok"}``.
    """
    return {"status": "ok"}


@app.post("/analyze-fit", response_model=AnalyzeFitResponse)
def analyze_fit_endpoint(
    body: AnalyzeFitRequest,
    x_openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
) -> AnalyzeFitResponse:
    """Analyze a resume against one or more job descriptions.

    Jobs with an empty description are skipped (order preserved); blank
    titles default to ``Job N``, 1-indexed over the valid jobs.

    Args:
        body: Request payload with ``resume_text`` and ``jobs``.
        x_openai_key: OpenAI API key from the ``X-OpenAI-Key`` header.

    Returns:
        An :class:`AnalyzeFitResponse` with one result per analyzed job.

    Raises:
        HTTPException: 400 if ``resume_text`` is empty or no API key is
            available; 502 if an OpenAI call fails.
    """
    if not body.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text must not be empty.")

    api_key = _resolve_api_key(x_openai_key)
    client = OpenAI(api_key=api_key)

    valid_jobs = [j for j in body.jobs if j.description.strip()]

    results = []
    for idx, job in enumerate(valid_jobs):
        title = job.title.strip() or f"Job {idx + 1}"
        parsed = analyze_fit(client, body.resume_text, title, job.description)
        results.append(
            JobResult(
                job_title=parsed.get("job_title", title),
                fit_score=parsed.get("fit_score"),
                matching_skills=parsed.get("matching_skills", []),
                missing_skills=parsed.get("missing_skills", []),
                suggested_tweaks=parsed.get("suggested_tweaks", []),
            )
        )

    return AnalyzeFitResponse(results=results)


@app.post("/rewrite-bullet", response_model=RewriteBulletResponse)
def rewrite_bullet_endpoint(
    body: RewriteBulletRequest,
    x_openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
) -> RewriteBulletResponse:
    """Rewrite a single resume bullet for a target job.

    Args:
        body: Request payload with ``bullet_text``, ``job_title``, and
            ``job_description``.
        x_openai_key: OpenAI API key from the ``X-OpenAI-Key`` header.

    Returns:
        A :class:`RewriteBulletResponse` with 2-3 rewrites.

    Raises:
        HTTPException: 400 if ``bullet_text`` or ``job_description`` is
            empty or no API key is available; 502 if an OpenAI call fails.
    """
    if not body.bullet_text.strip():
        raise HTTPException(status_code=400, detail="bullet_text must not be empty.")
    if not body.job_description.strip():
        raise HTTPException(status_code=400, detail="job_description must not be empty.")

    api_key = _resolve_api_key(x_openai_key)
    client = OpenAI(api_key=api_key)

    title = body.job_title.strip() or "Target job"
    parsed = rewrite_bullet(client, body.bullet_text, title, body.job_description)

    rewrites = [
        RewriteItem(rewrite=item.get("rewrite", ""), note=item.get("note", ""))
        for item in parsed.get("rewrites", [])
    ]

    return RewriteBulletResponse(
        job_title=parsed.get("job_title", title),
        rewrites=rewrites,
    )
