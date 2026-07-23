import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import type { Job } from "../types";

interface JobListProps {
  jobs: Job[];
  onChange: (jobs: Job[]) => void;
}

let counter = 0;
export function newJob(): Job {
  counter += 1;
  return {
    id: `job-${Date.now()}-${counter}`,
    title: "",
    description: "",
  };
}

export function JobList({ jobs, onChange }: JobListProps) {
  function update(id: string, patch: Partial<Job>) {
    onChange(jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }
  function remove(id: string) {
    onChange(jobs.filter((j) => j.id !== id));
  }
  function add() {
    onChange([...jobs, newJob()]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Job descriptions
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {jobs.length}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={add}
          icon={<Plus className="h-4 w-4" />}
        >
          Add job
        </Button>
      </CardHeader>

      <CardBody className="space-y-4">
        {jobs.map((job, idx) => (
          <div
            key={job.id}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {idx + 1}
              </span>
              <input
                type="text"
                value={job.title}
                onChange={(e) => update(job.id, { title: e.target.value })}
                placeholder={`Job title / label (e.g. "Data Analyst @ Acme")`}
                className="input-base flex-1"
                aria-label={`Job ${idx + 1} title`}
              />
              <button
                onClick={() => remove(job.id)}
                disabled={jobs.length === 1}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                aria-label={`Remove job ${idx + 1}`}
                title={jobs.length === 1 ? "Keep at least one job" : "Remove"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={job.description}
              onChange={(e) => update(job.id, { description: e.target.value })}
              rows={5}
              placeholder="Paste the full job description here…"
              className="input-base resize-y leading-relaxed"
              aria-label={`Job ${idx + 1} description`}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
