import streamlit as st
from openai import OpenAI
import pandas as pd
import plotly.express as px
import json
import re
from pypdf import PdfReader
import io
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from wordcloud import WordCloud

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
    reader = PdfReader(io.BytesIO(file.read()))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def analyze_fit(resume_text: str, job_title: str, job_description: str) -> dict:
    """
    Ask the LLM to compare a resume against a single job description and
    return a structured JSON result: fit_score, matching_skills,
    missing_skills, and suggested_tweaks.
    """
    client = OpenAI(api_key=openai_api_key)

    system_instructions = (
        "You are a helpful, precise career coach and technical recruiter. "
        "You always respond with a single valid JSON object and nothing else - "
        "no markdown fences, no commentary."
    )

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

    response = client.responses.create(
        model="gpt-4o",
        instructions=system_instructions,
        input=prompt,
    )

    raw = response.output_text.strip()
    # Defensive cleanup in case the model wraps the JSON in code fences anyway
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

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


def rewrite_bullet(bullet_text: str, job_title: str, job_description: str) -> dict:
    """
    Ask the LLM to rewrite a single resume bullet point so it's more
    relevant to a specific job. Returns a structured JSON result: a list of
    1-2 rewrites, each with a short note on what changed and why.
    """
    client = OpenAI(api_key=openai_api_key)

    system_instructions = (
        "You are a helpful, precise career coach and technical recruiter. "
        "You always respond with a single valid JSON object and nothing else - "
        "no markdown fences, no commentary."
    )

    prompt = f"""
Rewrite the RESUME BULLET below so it is more relevant and compelling for the JOB DESCRIPTION below.

Return ONLY a JSON object with exactly this key:
- "rewrites": a list of 1-2 objects, each with:
    - "rewrite": a single rewritten version of the bullet — one line, led with a strong action verb, quantified where reasonable, and tailored to this job. Do not invent facts not implied by the original bullet.
    - "note": a short one-line explanation of what changed and why it's a better fit for this specific job

RESUME BULLET:
{bullet_text}

JOB DESCRIPTION:
{job_description}
"""

    response = client.responses.create(
        model="gpt-4o",
        instructions=system_instructions,
        input=prompt,
    )

    raw = response.output_text.strip()
    # Defensive cleanup in case the model wraps the JSON in code fences anyway
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

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
# Free helpers (no OpenAI calls — run entirely locally, no cost)
# ---------------------------------------------------------------------------
def compute_keyword_score(resume_text: str, job_text: str) -> float:
    """
    Rough, free fit estimate using TF-IDF cosine similarity between the
    resume and job description. Not as nuanced as the AI analysis, but
    costs nothing to run.
    """
    if not resume_text.strip() or not job_text.strip():
        return 0.0
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf = vectorizer.fit_transform([resume_text, job_text])
    score = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    return round(score * 100, 1)


def generate_wordcloud_image(text: str):
    """Generate a word cloud image (PIL Image) from job description text."""
    wc = WordCloud(
        width=900,
        height=400,
        background_color="white",
        colormap="viridis",
        stopwords=None,
    ).generate(text)
    return wc.to_image()


def run_ats_checklist(resume_text: str) -> list:
    """
    Simple rule-based checks for common ATS-friendliness and completeness
    issues. Purely local — no API calls.
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
        "Sends your resume and job description(s) to OpenAI's API. "
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
        "Sends it to OpenAI's API — costs a small amount of your own OpenAI "
        "credit, same as the AI-Powered Analysis tab."
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
