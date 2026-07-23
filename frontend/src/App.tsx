import { useRef, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Sparkles,
  SplitSquareVertical,
} from "lucide-react";
import { Header } from "./components/Header";
import { ResumeInput } from "./components/ResumeInput";
import { JobList, newJob } from "./components/JobList";
import { AnalysisResults } from "./components/AnalysisResults";
import { RewriteTool } from "./components/RewriteTool";
import { FreeTools } from "./components/FreeTools";
import { Card, CardBody, CardHeader } from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { PaidBadge, FreeBadge } from "./components/ui/FeatureBadges";
import { ErrorBanner } from "./components/ui/Banners";
import { useLocalStorage } from "./lib/useLocalStorage";
import { analyzeFit, ApiError } from "./api";
import type { FitResult, Job } from "./types";
import { cn } from "./lib/cn";

type Tab = "analysis" | "free" | "rewrite";

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage("openai_api_key", "");
  const [resumeText, setResumeText] = useState("");
  const [jobs, setJobs] = useState<Job[]>(() => [newJob()]);
  const [tab, setTab] = useState<Tab>("analysis");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [results, setResults] = useState<FitResult[] | null>(null);

  const apiKeyPromptRef = useRef<HTMLDivElement>(null);
  const validJobs = jobs.filter((j) => j.description.trim());
  const canAnalyze = resumeText.trim().length > 0 && validJobs.length > 0;

  function focusApiKeyHint() {
    apiKeyPromptRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  async function handleAnalyze() {
    setAnalyzeError(null);
    if (!apiKey.trim()) {
      setAnalyzeError(
        "Add your OpenAI API key (top-right) to run AI analysis."
      );
      focusApiKeyHint();
      return;
    }
    if (!canAnalyze) return;

    setAnalyzing(true);
    setResults(null);
    try {
      const res = await analyzeFit(
        {
          resume_text: resumeText,
          jobs: validJobs.map((j) => ({
            title: j.title.trim() || "Untitled role",
            description: j.description,
          })),
        },
        apiKey
      );
      setResults(res.results);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Unexpected error during analysis. Please try again.";
      setAnalyzeError(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header apiKey={apiKey} onApiKeyChange={setApiKey} />

      <Hero />

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <ResumeInput resumeText={resumeText} onChange={setResumeText} />
          <JobList jobs={jobs} onChange={setJobs} />
        </div>

        <div ref={apiKeyPromptRef} className="mt-8">
          <Tabs tab={tab} onChange={setTab} />
        </div>

        <div className="mt-6">
          {tab === "analysis" && (
            <AnalysisPanel
              analyzing={analyzing}
              canAnalyze={canAnalyze}
              error={analyzeError}
              onDismissError={() => setAnalyzeError(null)}
              onAnalyze={handleAnalyze}
              results={results}
              hasResume={resumeText.trim().length > 0}
              jobCount={validJobs.length}
            />
          )}
          {tab === "free" && <FreeTools resumeText={resumeText} jobs={jobs} />}
          {tab === "rewrite" && (
            <RewriteTool
              jobs={jobs}
              apiKey={apiKey}
              onRequireApiKey={focusApiKeyHint}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered résumé tailoring
        </div>
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          See how well your résumé{" "}
          <span className="text-brand-600">fits any job</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Score your fit against multiple roles, uncover skill gaps, and rewrite
          your bullets to land the interview — with AI, or free tools that run
          entirely in your browser.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <PaidBadge />
          <FreeBadge />
        </div>
      </div>
    </section>
  );
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    kind: "paid" | "free";
  }[] = [
    {
      id: "analysis",
      label: "AI Analysis",
      icon: <SplitSquareVertical className="h-4 w-4" />,
      kind: "paid",
    },
    {
      id: "free",
      label: "Free Tools",
      icon: <ClipboardList className="h-4 w-4" />,
      kind: "free",
    },
    {
      id: "rewrite",
      label: "Rewrite Bullet",
      icon: <Sparkles className="h-4 w-4" />,
      kind: "paid",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft">
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "group relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {item.icon}
            {item.label}
            <span
              className={cn(
                "hidden h-1.5 w-1.5 rounded-full sm:inline-block",
                item.kind === "paid"
                  ? active
                    ? "bg-white/70"
                    : "bg-brand-400"
                  : active
                    ? "bg-white/70"
                    : "bg-emerald-500"
              )}
              title={
                item.kind === "paid"
                  ? "Uses your OpenAI credit"
                  : "Free · runs in your browser"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

function AnalysisPanel({
  analyzing,
  canAnalyze,
  error,
  onDismissError,
  onAnalyze,
  results,
  hasResume,
  jobCount,
}: {
  analyzing: boolean;
  canAnalyze: boolean;
  error: string | null;
  onDismissError: () => void;
  onAnalyze: () => void;
  results: FitResult[] | null;
  hasResume: boolean;
  jobCount: number;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-semibold text-slate-900">
              AI-powered fit analysis
            </h2>
          </div>
          <PaidBadge />
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-slate-500">
            Sends your résumé and job descriptions to the analysis backend
            (which uses your OpenAI key) and returns a fit score, matching
            skills, gaps, and tailoring suggestions for each role.
          </p>

          {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={onAnalyze}
              loading={analyzing}
              disabled={!canAnalyze}
              size="lg"
              icon={!analyzing ? <ArrowRight className="h-4 w-4" /> : undefined}
            >
              {analyzing ? "Analyzing…" : "Analyze fit"}
            </Button>
            {!canAnalyze && (
              <span className="text-xs text-slate-400">
                {!hasResume
                  ? "Add your résumé above to continue."
                  : jobCount === 0
                    ? "Add at least one job description above."
                    : ""}
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {analyzing && <AnalysisSkeleton />}

      {results && !analyzing && results.length > 0 && (
        <AnalysisResults results={results} />
      )}

      {!analyzing && !results && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <SplitSquareVertical className="h-6 w-6" />
          </div>
          <p className="max-w-sm text-sm text-slate-500">
            Your fit scores, skill matches, and tailoring tips will appear here
            after you run the analysis.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-start justify-between">
            <div className="h-5 w-1/2 rounded bg-slate-200" />
            <div className="h-14 w-14 rounded-xl bg-slate-200" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-slate-100" />
              <div className="h-6 w-20 rounded-full bg-slate-100" />
              <div className="h-6 w-14 rounded-full bg-slate-100" />
            </div>
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-16 w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
        <p>
          Résumé ↔ Job Fit Analyzer · AI features use your own OpenAI key ·
          Free tools run locally in your browser.
        </p>
      </div>
    </footer>
  );
}
