import {
  BarChart3,
  CheckCircle2,
  Download,
  Lightbulb,
  XCircle,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { FitScoreChart } from "./FitScoreChart";
import { scoreColor } from "../lib/score";
import type { FitResult } from "../types";
import { cn } from "../lib/cn";

interface AnalysisResultsProps {
  results: FitResult[];
}

export function AnalysisResults({ results }: AnalysisResultsProps) {
  const scored = results.filter((r) => typeof r.fit_score === "number");

  function exportCsv() {
    const header = [
      "Job title",
      "Fit score",
      "Matching skills",
      "Missing skills",
      "Suggested tweaks",
    ];
    const rows = results.map((r) => [
      r.job_title,
      r.fit_score ?? "",
      r.matching_skills.join("; "),
      r.missing_skills.join("; "),
      r.suggested_tweaks.join("; "),
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-fit-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {scored.length > 1 && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600" />
            <h3 className="text-base font-semibold text-slate-900">
              Fit score comparison
            </h3>
          </CardHeader>
          <CardBody>
            <FitScoreChart results={results} />
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {results.length} job{results.length === 1 ? "" : "s"} analyzed
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          icon={<Download className="h-4 w-4" />}
        >
          Export CSV
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {results.map((result, i) => (
          <ResultCard key={i} result={result} />
        ))}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: FitResult }) {
  const hasScore = typeof result.fit_score === "number";
  const style = hasScore ? scoreColor(result.fit_score as number) : null;

  return (
    <Card className="flex flex-col animate-fade-in">
      <CardHeader className="flex items-start justify-between gap-3">
        <h3 className="pt-1 text-base font-semibold text-slate-900">
          {result.job_title || "Untitled role"}
        </h3>
        {hasScore && style ? (
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-14 w-14 flex-col items-center justify-center rounded-xl font-bold leading-none",
                style.badge
              )}
            >
              <span className="text-xl">{result.fit_score}</span>
              <span className="text-[10px] font-medium opacity-90">/ 10</span>
            </div>
            <span className={cn("mt-1 text-xs font-medium", style.text)}>
              {style.label}
            </span>
          </div>
        ) : (
          <Badge variant="slate">No score</Badge>
        )}
      </CardHeader>

      <CardBody className="flex-1 space-y-5">
        <SkillGroup
          title="Matching skills"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          skills={result.matching_skills}
          variant="green"
          empty="No clear matches detected."
        />
        <SkillGroup
          title="Missing / gap skills"
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          skills={result.missing_skills}
          variant="red"
          empty="No significant gaps flagged."
        />

        {result.suggested_tweaks.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-700">
                Suggested tweaks
              </h4>
            </div>
            <ul className="space-y-2">
              {result.suggested_tweaks.map((tweak, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 rounded-lg bg-amber-50/60 px-3 py-2 text-sm text-slate-700"
                >
                  <span className="mt-0.5 select-none font-bold text-amber-500">
                    →
                  </span>
                  <span>{tweak}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SkillGroup({
  title,
  icon,
  skills,
  variant,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  skills: string[];
  variant: "green" | "red";
  empty: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        <span className="text-xs text-slate-400">({skills.length})</span>
      </div>
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill, i) => (
            <Badge key={i} variant={variant}>
              {skill}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}
