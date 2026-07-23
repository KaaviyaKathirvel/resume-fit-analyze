import { useMemo, useState } from "react";
import { Cloud, ListChecks, Percent, Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { FreeBadge } from "./ui/FeatureBadges";
import {
  buildWordCloud,
  computeKeywordScore,
  runAtsChecklist,
} from "../lib/freeTools";
import { keywordColor } from "../lib/score";
import type { Job } from "../types";
import { cn } from "../lib/cn";

interface FreeToolsProps {
  resumeText: string;
  jobs: Job[];
}

export function FreeTools({ resumeText, jobs }: FreeToolsProps) {
  const validJobs = jobs.filter((j) => j.description.trim());

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <FreeBadge />
          <p className="text-sm text-emerald-800">
            These tools run 100% in your browser. No API key, no cost, and
            nothing leaves your device.
          </p>
        </div>
      </div>

      <KeywordScoreTool resumeText={resumeText} jobs={validJobs} />
      <WordCloudTool jobs={validJobs} />
      <AtsChecklistTool resumeText={resumeText} />
    </div>
  );
}

/* ---------------- Keyword match score ---------------- */

function KeywordScoreTool({
  resumeText,
  jobs,
}: {
  resumeText: string;
  jobs: Job[];
}) {
  const scores = useMemo(() => {
    if (!resumeText.trim()) return [];
    return jobs.map((j, i) => ({
      title: j.title.trim() || `Job ${i + 1}`,
      score: computeKeywordScore(resumeText, j.description),
    }));
  }, [resumeText, jobs]);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <Percent className="h-5 w-5 text-emerald-600" />
        <h3 className="text-base font-semibold text-slate-900">
          Keyword match score
        </h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-slate-500">
          TF-IDF cosine similarity between your résumé and each job description.
          A rough proxy for keyword overlap — higher is more aligned.
        </p>
        {!resumeText.trim() ? (
          <EmptyState message="Add your résumé to compute keyword scores." />
        ) : jobs.length === 0 ? (
          <EmptyState message="Add at least one job description." />
        ) : (
          <div className="space-y-3">
            {scores.map((s, i) => {
              const c = keywordColor(s.score);
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{s.title}</span>
                    <span className={cn("font-bold", c.text)}>{s.score}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.score}%`, backgroundColor: c.hex }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------- Word cloud ---------------- */

function WordCloudTool({ jobs }: { jobs: Job[] }) {
  const [selected, setSelected] = useState(0);
  const idx = Math.min(selected, Math.max(0, jobs.length - 1));
  const job = jobs[idx];

  const words = useMemo(
    () => (job ? buildWordCloud(job.description, 40) : []),
    [job]
  );

  const palette = [
    "#4f46e5", "#6366f1", "#0891b2", "#0d9488", "#16a34a",
    "#7c3aed", "#db2777", "#ea580c", "#475569",
  ];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-slate-900">
            Job word cloud
          </h3>
        </div>
        {jobs.length > 1 && (
          <select
            value={idx}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="input-base w-auto cursor-pointer py-1.5 text-sm"
            aria-label="Choose job for word cloud"
          >
            {jobs.map((j, i) => (
              <option key={j.id} value={i}>
                {j.title.trim() || `Job ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-sm text-slate-500">
          The most frequent meaningful words in the job description — a quick
          read on what the role emphasizes.
        </p>
        {jobs.length === 0 ? (
          <EmptyState message="Add a job description to see its word cloud." />
        ) : words.length === 0 ? (
          <EmptyState message="Not enough text in this job description." />
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl bg-slate-50 px-4 py-8">
            {words.map((w, i) => {
              const size = 0.85 + w.weight * 1.75; // rem
              const color = palette[i % palette.length];
              const opacity = 0.55 + w.weight * 0.45;
              return (
                <span
                  key={w.text}
                  className="font-semibold leading-tight transition hover:scale-110"
                  style={{
                    fontSize: `${size}rem`,
                    color,
                    opacity,
                  }}
                  title={`${w.text}: ${w.count}×`}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------- ATS checklist ---------------- */

function AtsChecklistTool({ resumeText }: { resumeText: string }) {
  const checks = useMemo(
    () => (resumeText.trim() ? runAtsChecklist(resumeText) : []),
    [resumeText]
  );
  const passed = checks.filter((c) => c.passed).length;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-slate-900">
            ATS readiness checklist
          </h3>
        </div>
        {checks.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {passed} / {checks.length} passed
          </span>
        )}
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-sm text-slate-500">
          Quick rule-based checks for applicant-tracking-system friendliness.
        </p>
        {checks.length === 0 ? (
          <EmptyState message="Add your résumé to run the checklist." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {checks.map((check, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    check.passed ? "bg-emerald-500" : "bg-amber-500"
                  )}
                  aria-hidden="true"
                >
                  {check.passed ? "✓" : "!"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {check.label}
                  </p>
                  <p className="text-xs text-slate-500">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------- shared empty state ---------------- */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <Sparkles className="h-6 w-6 text-slate-300" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
