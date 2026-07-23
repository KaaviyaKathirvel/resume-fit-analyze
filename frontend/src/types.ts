export interface Job {
  id: string;
  title: string;
  description: string;
}

export interface JobPayload {
  title: string;
  description: string;
}

// ---- /analyze-fit ----
export interface AnalyzeFitRequest {
  resume_text: string;
  jobs: JobPayload[];
}

export interface FitResult {
  job_title: string;
  fit_score: number | null;
  matching_skills: string[];
  missing_skills: string[];
  suggested_tweaks: string[];
}

export interface AnalyzeFitResponse {
  results: FitResult[];
}

// ---- /rewrite-bullet ----
export interface RewriteBulletRequest {
  bullet_text: string;
  job_title: string;
  job_description: string;
}

export interface RewriteItem {
  rewrite: string;
  note: string;
}

export interface RewriteBulletResponse {
  job_title: string;
  rewrites: RewriteItem[];
}

// ---- health ----
export interface HealthResponse {
  status: string;
}

// ---- free tools ----
export interface KeywordScore {
  title: string;
  score: number; // 0-100
}

export interface AtsCheck {
  label: string;
  passed: boolean;
  detail: string;
}
