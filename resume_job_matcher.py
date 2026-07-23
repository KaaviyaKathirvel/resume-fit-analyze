import streamlit as st
import requests
import os
import pandas as pd
import plotly.express as px
import json
import re
from pypdf import PdfReader
import io
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from wordcloud import WordCloud

# Backend that owns the OpenAI calls. Configurable via env var; defaults to local.
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

st.set_page_config(page_title="Resume ↔ Job Fit Analyzer", page_icon="🎯", layout="wide")
st.title("🎯 Resume ↔ Job Description Fit Analyzer")
st.markdown(
    "Paste your resume and one or more job descriptions. "
    "The app scores your fit for each role, highlights matching/missing skills, "
    "and suggests concrete resume tweaks."
)

with st.expander("ℹ️ What you'll need before you start", expanded=True):
    st.markdown(
        """
- **Your own OpenAI API key**, with billing enabled on your OpenAI account.
  Get one at [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys) —
  paste it in the sidebar, it's never stored or shared.
- **A small amount of OpenAI credit.** Usage is billed to *your* OpenAI account,
  not this app — typically just **a cent or two per job analyzed**, so $5 goes a long way.
- **A PDF or pasted text of your resume**, plus one or more job descriptions to compare it against.

**Having trouble uploading a PDF?** Some browser ad blockers or privacy extensions
block the upload. Try an **incognito/private window**, or switch to **"Paste text"** instead.
        """
    )

# ---------------------------------------------------------------------------
# Sidebar: API key
# ---------------------------------------------------------------------------
openai_api_key = st.sidebar.text_input(
    "Enter your OpenAI API Key",
    type="password",
    help="You can find your API key at https://platform.openai.com/account/api-keys",
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def extract_text_from_pdf(file) -> str:
    """Extract text from an uploaded PDF file.

    Args:
        file: A file-like object (e.g. a Streamlit ``UploadedFile``)
            containing PDF bytes.

    Returns:
        The concatenated text of all pages, joined by newlines.
    """
    reader = PdfReader(io.BytesIO(file.read()))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def analyze_fit(resume_text: str, job_title: str, job_description: str) -> dict:
    """Compare a resume against a single job description via the backend.

    Posts a one-element jobs list to ``POST /analyze-fit`` and unwraps
    ``results[0]`` so the calling UI keeps working unchanged. On connection
    or HTTP errors, surfaces the problem via ``st.error`` and returns a
    same-shaped fallback dict.

    Args:
        resume_text: The full resume text.
        job_title: Label for the target job.
        job_description: The target job description.

    Returns:
        A dict with ``fit_score``, ``matching_skills``, ``missing_skills``,
        ``suggested_tweaks``, and ``job_title``.
    """
    def _fallback(tweak: str) -> dict:
        """Show an error and return an empty, same-shaped result."""
        st.error(tweak)
        return {
            "fit_score": None,
            "matching_skills": [],
            "missing_skills": [],
            "suggested_tweaks": [tweak],
            "job_title": job_title,
        }

    payload = {
        "resume_text": resume_text,
        "jobs": [{"title": job_title, "description": job_description}],
    }

    try:
        response = requests.post(
            f"{BACKEND_URL}/analyze-fit",
            json=payload,
            headers={"X-OpenAI-Key": openai_api_key or ""},
            timeout=120,
        )
    except requests.exceptions.RequestException as err:
        return _fallback(f"Could not reach backend at {BACKEND_URL}: {err}")

    if response.status_code != 200:
        return _fallback(
            f"Backend returned {response.status_code}: {response.text[:300]}"
        )

    try:
        results = response.json().get("results", [])
        parsed = dict(results[0])
    except (json.JSONDecodeError, ValueError, IndexError, TypeError):
        return _fallback(
            f"Could not parse backend response: {response.text[:200]}"
        )

    parsed["job_title"] = job_title
    return parsed


def rewrite_bullet(bullet_text: str, job_title: str, job_description: str) -> dict:
    """Rewrite a single resume bullet via the backend.

    Posts to ``POST /rewrite-bullet`` so the bullet better targets a
    specific job. On connection or HTTP errors, surfaces the problem via
    ``st.error`` and returns a same-shaped fallback dict.

    Args:
        bullet_text: The single resume bullet point to rewrite.
        job_title: Label for the target job.
        job_description: The target job description.

    Returns:
        A dict with ``rewrites`` (a list of ``{"rewrite", "note"}`` objects)
        and ``job_title``.
    """
    def _fallback(note: str) -> dict:
        """Show an error and return the original bullet as a fallback."""
        st.error(note)
        return {
            "rewrites": [{"rewrite": bullet_text, "note": note}],
            "job_title": job_title,
        }

    payload = {
        "bullet_text": bullet_text,
        "job_title": job_title,
        "job_description": job_description,
    }

    try:
        response = requests.post(
            f"{BACKEND_URL}/rewrite-bullet",
            json=payload,
            headers={"X-OpenAI-Key": openai_api_key or ""},
            timeout=120,
        )
    except requests.exceptions.RequestException as err:
        return _fallback(f"Could not reach backend at {BACKEND_URL}: {err}")

    if response.status_code != 200:
        return _fallback(
            f"Backend returned {response.status_code}: {response.text[:300]}"
        )

    try:
        parsed = dict(response.json())
        parsed.setdefault("rewrites", [])
    except (json.JSONDecodeError, ValueError, TypeError):
        return _fallback(
            f"Could not parse backend response: {response.text[:200]}"
        )

    parsed["job_title"] = job_title
    return parsed


# ---------------------------------------------------------------------------
# Free helpers (no OpenAI calls — run entirely locally, no cost)
# ---------------------------------------------------------------------------
def compute_keyword_score(resume_text: str, job_text: str) -> float:
    """Estimate resume/job fit locally via TF-IDF cosine similarity.

    A rough, free alternative to the AI analysis — runs entirely on the
    local machine with no OpenAI calls.

    Args:
        resume_text: The full resume text.
        job_text: The job description text.

    Returns:
        A similarity score from 0.0 to 100.0 (percent), rounded to one
        decimal place; 0.0 if either input is blank.
    """
    if not resume_text.strip() or not job_text.strip():
        return 0.0
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf = vectorizer.fit_transform([resume_text, job_text])
    score = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    return round(score * 100, 1)


def generate_wordcloud_image(text: str):
    """Generate a word cloud image from job description text.

    Args:
        text: The text to visualize (e.g. a job description).

    Returns:
        A PIL ``Image`` of the rendered word cloud.
    """
    wc = WordCloud(
        width=900,
        height=400,
        background_color="white",
        colormap="viridis",
        stopwords=None,
    ).generate(text)
    return wc.to_image()


def run_ats_checklist(resume_text: str) -> list:
    """Run rule-based ATS-friendliness checks on a resume.

    Checks length, presence of an email and phone number, standard
    sections, and bullet points. Purely local — no API calls.

    Args:
        resume_text: The full resume text.

    Returns:
        A list of ``(label, passed, detail)`` tuples, where ``label`` is
        the check name, ``passed`` is a bool, and ``detail`` is a
        human-readable explanation.
    """
    checks = []

    word_count = len(resume_text.split())
    checks.append((
        "Reasonable length",
        200 <= word_count <= 1000,
        f"{word_count} words (ideal range: roughly 200–1000)",
    ))

    has_email = bool(re.search(r"[\w.\-]+@[\w.\-]+\.\w+", resume_text))
    checks.append((
        "Contains an email address",
        has_email,
        "Found" if has_email else "Not found — make sure contact info is included",
    ))

    has_phone = bool(re.search(r"(\+?\d[\d\-\s().]{8,}\d)", resume_text))
    checks.append((
        "Contains a phone number",
        has_phone,
        "Found" if has_phone else "Not found — consider adding one",
    ))

    section_keywords = ["experience", "education", "skills"]
    found_sections = [s for s in section_keywords if s in resume_text.lower()]
    checks.append((
        "Has standard sections (Experience / Education / Skills)",
        len(found_sections) >= 2,
        f"Found: {', '.join(found_sections) if found_sections else 'none detected'}",
    ))

    has_bullets = ("•" in resume_text) or bool(re.search(r"^\s*[-*]\s", resume_text, re.MULTILINE))
    checks.append((
        "Uses bullet points",
        has_bullets,
        "Found" if has_bullets else "Consider using bullet points — many ATS and recruiters scan for them",
    ))

    return checks


# ---------------------------------------------------------------------------
# Resume input
# ---------------------------------------------------------------------------
st.header("1. Your resume")
resume_input_method = st.radio(
    "How would you like to provide your resume?",
    ["Upload PDF", "Paste text"],
    horizontal=True,
)

resume_text = ""
if resume_input_method == "Upload PDF":
    resume_file = st.file_uploader("Upload your resume (PDF)", type=["pdf"])
    st.caption(
        "⚠️ If the upload fails with a 403/network error, it's usually a browser "
        "extension (ad blocker or privacy tool) blocking it. Try an incognito/private "
        "window, or use 'Paste text' instead."
    )
    if resume_file is not None:
        resume_text = extract_text_from_pdf(resume_file)
        with st.expander("Preview extracted resume text"):
            st.text(resume_text[:3000] + ("..." if len(resume_text) > 3000 else ""))
else:
    resume_text = st.text_area("Paste your resume text", height=250)

# ---------------------------------------------------------------------------
# Job description input (support multiple jobs)
# ---------------------------------------------------------------------------
st.header("2. Job description(s)")

if "jobs" not in st.session_state:
    st.session_state.jobs = [{"title": "", "description": ""}]

for i, job in enumerate(st.session_state.jobs):
    col1, col2 = st.columns([1, 3])
    with col1:
        job["title"] = st.text_input(
            f"Job title / label #{i + 1}",
            value=job["title"],
            key=f"title_{i}",
            placeholder="e.g. Data Analyst @ Acme Co",
        )
    with col2:
        job["description"] = st.text_area(
            f"Paste job description #{i + 1}",
            value=job["description"],
            key=f"desc_{i}",
            height=150,
        )

col_add, col_remove = st.columns([1, 1])
with col_add:
    if st.button("➕ Add another job"):
        st.session_state.jobs.append({"title": "", "description": ""})
        st.rerun()
with col_remove:
    if len(st.session_state.jobs) > 1 and st.button("➖ Remove last job"):
        st.session_state.jobs.pop()
        st.rerun()

# ---------------------------------------------------------------------------
# Analysis: AI-powered (costs OpenAI credit) vs Free tools (no cost)
# ---------------------------------------------------------------------------
st.header("3. Analysis")

tab_ai, tab_free, tab_rewrite = st.tabs([
    "🤖 AI-Powered Analysis (uses OpenAI credit)",
    "🆓 Free Tools (no cost, no API key needed)",
    "✏️ Rewrite a Bullet Point",
])

# --- Tab 1: AI-powered analysis --------------------------------------------
with tab_ai:
    st.caption(
        "Sends your resume and job description(s) to OpenAI's API via the backend service. "
        "Costs a small amount of your own OpenAI credit — typically a cent or two per job."
    )

    if st.button("🚀 Analyze fit", type="primary"):
        if not openai_api_key:
            st.error("Please enter your OpenAI API key in the sidebar.")
        elif not resume_text.strip():
            st.error("Please provide your resume (upload a PDF or paste text).")
        elif not any(job["description"].strip() for job in st.session_state.jobs):
            st.error("Please paste at least one job description.")
        else:
            results = []
            progress = st.progress(0, text="Analyzing jobs...")
            valid_jobs = [j for j in st.session_state.jobs if j["description"].strip()]

            for idx, job in enumerate(valid_jobs):
                title = job["title"].strip() or f"Job {idx + 1}"
                result = analyze_fit(resume_text, title, job["description"])
                results.append(result)
                progress.progress((idx + 1) / len(valid_jobs), text=f"Analyzed {title}")

            progress.empty()
            st.session_state.results = results

    if "results" in st.session_state and st.session_state.results:
        results = st.session_state.results
        df = pd.DataFrame(results)

        st.subheader("Fit score by job")
        fig = px.bar(
            df,
            x="job_title",
            y="fit_score",
            color="fit_score",
            color_continuous_scale="RdYlGn",
            range_color=[1, 10],
            labels={"job_title": "Job", "fit_score": "Fit score (1-10)"},
            text="fit_score",
        )
        fig.update_layout(yaxis_range=[0, 10], coloraxis_showscale=False)
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Details per job")
        for result in results:
            score = result.get("fit_score")
            with st.expander(f"**{result['job_title']}** — Fit score: {score}/10"):
                col1, col2 = st.columns(2)
                with col1:
                    st.markdown("**✅ Matching skills**")
                    for skill in result.get("matching_skills", []):
                        st.markdown(f"- {skill}")
                with col2:
                    st.markdown("**⚠️ Missing / gap areas**")
                    for skill in result.get("missing_skills", []):
                        st.markdown(f"- {skill}")

                st.markdown("**✏️ Suggested resume tweaks**")
                for tweak in result.get("suggested_tweaks", []):
                    st.markdown(f"- {tweak}")

        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Download results as CSV",
            data=csv,
            file_name="resume_job_fit_results.csv",
            mime="text/csv",
        )

# --- Tab 2: Free tools (no OpenAI calls, no cost) ---------------------------
with tab_free:
    st.caption(
        "These tools run entirely on your machine — no OpenAI API key or credit required. "
        "The keyword match score is a rough heuristic, not as nuanced as the AI analysis."
    )

    valid_jobs = [j for j in st.session_state.jobs if j["description"].strip()]

    # --- Free keyword match score ---
    st.subheader("🔑 Keyword match score")
    if st.button("Compute keyword match score"):
        if not resume_text.strip():
            st.error("Please provide your resume above first.")
        elif not valid_jobs:
            st.error("Please paste at least one job description above first.")
        else:
            free_results = []
            for idx, job in enumerate(valid_jobs):
                title = job["title"].strip() or f"Job {idx + 1}"
                score = compute_keyword_score(resume_text, job["description"])
                free_results.append({"job_title": title, "keyword_score": score})
            st.session_state.free_results = free_results

    if "free_results" in st.session_state and st.session_state.free_results:
        free_df = pd.DataFrame(st.session_state.free_results)
        fig_free = px.bar(
            free_df,
            x="job_title",
            y="keyword_score",
            color="keyword_score",
            color_continuous_scale="Blues",
            range_color=[0, 100],
            labels={"job_title": "Job", "keyword_score": "Keyword match (%)"},
            text="keyword_score",
        )
        fig_free.update_layout(yaxis_range=[0, 100], coloraxis_showscale=False)
        st.plotly_chart(fig_free, use_container_width=True)

    st.divider()

    # --- Free job description word cloud ---
    st.subheader("☁️ Job description keyword cloud")
    if valid_jobs:
        job_titles = [j["title"].strip() or f"Job {i + 1}" for i, j in enumerate(valid_jobs)]
        selected_title = st.selectbox("Pick a job to visualize", job_titles)
        if st.button("Generate word cloud"):
            selected_job = valid_jobs[job_titles.index(selected_title)]
            image = generate_wordcloud_image(selected_job["description"])
            st.image(image, use_container_width=True)
    else:
        st.info("Paste at least one job description above to generate a word cloud.")

    st.divider()

    # --- Free ATS checklist ---
    st.subheader("✅ Resume ATS checklist")
    if st.button("Run ATS checklist"):
        if not resume_text.strip():
            st.error("Please provide your resume above first.")
        else:
            checklist = run_ats_checklist(resume_text)
            for label, passed, detail in checklist:
                icon = "✅" if passed else "⚠️"
                st.markdown(f"{icon} **{label}** — {detail}")

# --- Tab 3: Rewrite a bullet point (costs OpenAI credit) --------------------
with tab_rewrite:
    st.caption(
        "Rewrites a single resume bullet to better target a specific job. "
        "Sends it to OpenAI's API via the backend service — costs a small amount of your own "
        "OpenAI credit, same as the AI-Powered Analysis tab."
    )

    bullet_text = st.text_area(
        "Paste one resume bullet point to rewrite",
        key="rewrite_bullet_input",
        height=100,
        placeholder="e.g. Built internal dashboards for the sales team using SQL and Excel",
    )

    valid_jobs = [j for j in st.session_state.jobs if j["description"].strip()]

    # Pick the target job: reuse a job entered above, or paste one directly.
    PASTE_OPTION = "✏️ Paste a different job description"
    target_description = ""
    target_title = "Target job"

    if valid_jobs:
        job_titles = [j["title"].strip() or f"Job {i + 1}" for i, j in enumerate(valid_jobs)]
        choice = st.selectbox(
            "Which job should this bullet target?",
            job_titles + [PASTE_OPTION],
            key="rewrite_job_choice",
        )
        if choice == PASTE_OPTION:
            target_description = st.text_area(
                "Paste the target job description",
                key="rewrite_job_paste",
                height=150,
            )
        else:
            selected_job = valid_jobs[job_titles.index(choice)]
            target_title = choice
            target_description = selected_job["description"]
    else:
        st.info("No job descriptions entered above — paste one here to target it.")
        target_description = st.text_area(
            "Paste the target job description",
            key="rewrite_job_paste",
            height=150,
        )

    if st.button("✏️ Rewrite bullet point", type="primary"):
        if not openai_api_key:
            st.error("Please enter your OpenAI API key in the sidebar.")
        elif not bullet_text.strip():
            st.error("Please paste a resume bullet point to rewrite.")
        elif not target_description.strip():
            st.error("Please pick or paste a target job description.")
        else:
            with st.spinner("Rewriting your bullet point..."):
                st.session_state.rewrite_result = rewrite_bullet(
                    bullet_text, target_title, target_description
                )

    if "rewrite_result" in st.session_state and st.session_state.rewrite_result:
        result = st.session_state.rewrite_result
        st.subheader(f"Suggested rewrites — targeting {result.get('job_title', 'the job')}")
        for idx, item in enumerate(result.get("rewrites", []), start=1):
            st.markdown(f"**Version {idx}**")
            st.markdown(f"> {item.get('rewrite', '')}")
            note = item.get("note")
            if note:
                st.caption(f"💡 What changed: {note}")
            st.divider()
