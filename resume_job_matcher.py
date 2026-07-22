import streamlit as st
from openai import OpenAI
import pandas as pd
import plotly.express as px
import json
from pypdf import PdfReader
import io

st.set_page_config(page_title="Resume ↔ Job Fit Analyzer", page_icon="🎯", layout="wide")
st.title("🎯 Resume ↔ Job Description Fit Analyzer")
st.markdown(
    "Paste your resume and one or more job descriptions. "
    "The app scores your fit for each role, highlights matching/missing skills, "
    "and suggests concrete resume tweaks."
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
# Run analysis
# ---------------------------------------------------------------------------
st.header("3. Analysis")

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

# ---------------------------------------------------------------------------
# Display results
# ---------------------------------------------------------------------------
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
