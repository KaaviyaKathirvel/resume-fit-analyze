import { useEffect, useState } from "react";
import { Copy, Check, PenLine, Wand2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { PaidBadge } from "./ui/FeatureBadges";
import { ErrorBanner, InfoNote } from "./ui/Banners";
import { rewriteBullet, ApiError } from "../api";
import type { Job, RewriteBulletResponse } from "../types";

interface RewriteToolProps {
  jobs: Job[];
  apiKey: string;
  onRequireApiKey: () => void;
}

const CUSTOM = "__custom__";

export function RewriteTool({ jobs, apiKey, onRequireApiKey }: RewriteToolProps) {
  const validJobs = jobs.filter((j) => j.description.trim());

  const [bullet, setBullet] = useState("");
  const [target, setTarget] = useState<string>(CUSTOM);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RewriteBulletResponse | null>(null);

  // Default to the first valid job when one becomes available.
  useEffect(() => {
    if (target === CUSTOM && validJobs.length > 0) {
      setTarget(validJobs[0].id);
    }
    if (target !== CUSTOM && !validJobs.some((j) => j.id === target)) {
      setTarget(validJobs[0]?.id ?? CUSTOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validJobs.length]);

  const usingCustom = target === CUSTOM;
  const selectedJob = validJobs.find((j) => j.id === target);
  const jobTitle = usingCustom ? customTitle : selectedJob?.title ?? "";
  const jobDescription = usingCustom
    ? customDesc
    : selectedJob?.description ?? "";

  const canSubmit =
    bullet.trim().length > 0 && jobDescription.trim().length > 0;

  async function handleSubmit() {
    setError(null);
    if (!apiKey.trim()) {
      setError("Add your OpenAI API key first (top-right) to use this feature.");
      onRequireApiKey();
      return;
    }
    if (!canSubmit) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await rewriteBullet(
        {
          bullet_text: bullet,
          job_title: jobTitle || "the target role",
          job_description: jobDescription,
        },
        apiKey
      );
      setResult(res);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Unexpected error while rewriting. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Rewrite a bullet point
          </h2>
        </div>
        <PaidBadge />
      </CardHeader>

      <CardBody className="space-y-5">
        <p className="text-sm text-slate-500">
          Sharpen a single résumé bullet so it targets a specific role — led with
          a strong verb, quantified, and tailored. Returns 2–3 variations.
        </p>

        <div>
          <label htmlFor="bullet" className="label-base">
            Your bullet point
          </label>
          <textarea
            id="bullet"
            value={bullet}
            onChange={(e) => setBullet(e.target.value)}
            rows={3}
            placeholder="e.g. Responsible for managing the team's reporting process"
            className="input-base resize-y"
          />
        </div>

        <div>
          <label htmlFor="target" className="label-base">
            Target job
          </label>
          <select
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="input-base cursor-pointer"
          >
            {validJobs.map((j, i) => (
              <option key={j.id} value={j.id}>
                {j.title.trim() || `Job ${i + 1}`}
              </option>
            ))}
            <option value={CUSTOM}>+ Paste a new job description…</option>
          </select>
        </div>

        {usingCustom && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Job title (optional)"
              className="input-base"
            />
            <textarea
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              rows={4}
              placeholder="Paste the job description to target…"
              className="input-base resize-y"
            />
          </div>
        )}

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
            icon={!loading ? <Wand2 className="h-4 w-4" /> : undefined}
          >
            {loading ? "Rewriting…" : "Rewrite bullet"}
          </Button>
          {!canSubmit && (
            <span className="text-xs text-slate-400">
              Add a bullet and a target job description.
            </span>
          )}
        </div>

        {loading && <RewriteSkeleton />}

        {result && !loading && (
          <div className="space-y-3">
            <InfoNote>
              Tailored for{" "}
              <span className="font-semibold text-slate-700">
                {result.job_title}
              </span>
              . Pick the version that fits your voice.
            </InfoNote>
            {result.rewrites.map((r, i) => (
              <RewriteCard key={i} index={i} rewrite={r.rewrite} note={r.note} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RewriteCard({
  index,
  rewrite,
  note,
}: {
  index: number;
  rewrite: string;
  note: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(rewrite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className="animate-fade-in rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {index + 1}
          </span>
          <p className="text-sm font-medium leading-relaxed text-slate-800">
            {rewrite}
          </p>
        </div>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Copy rewrite"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      {note && (
        <p className="mt-2 border-t border-slate-100 pl-9 pt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">What changed: </span>
          {note}
        </p>
      )}
    </div>
  );
}

function RewriteSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
