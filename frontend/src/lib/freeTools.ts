import type { AtsCheck } from "../types";

// A compact but reasonable English stopword list.
export const STOPWORDS = new Set<string>([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at",
  "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "to", "from", "up", "down",
  "in", "out", "on", "off", "over", "under", "again", "further", "of", "as",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "would", "should", "could", "ought",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "this", "that", "these",
  "those", "am", "not", "no", "nor", "so", "than", "too", "very", "can",
  "will", "just", "also", "such", "only", "own", "same", "more", "most",
  "other", "some", "any", "each", "few", "all", "both", "who", "whom", "which",
  "what", "where", "why", "how", "there", "here", "s", "t", "re", "ve", "ll",
  "d", "m", "etc", "e", "g", "ie", "eg", "per", "via", "within", "including",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z+#.\-]*[a-z+#]|[a-z]/g) ?? [])
    .map((w) => w.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((w) => w.length > 1);
}

function contentTokens(text: string): string[] {
  return tokenize(text).filter((w) => !STOPWORDS.has(w));
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const tok of tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);
  return tf;
}

/**
 * TF-IDF-weighted cosine similarity between a resume and a job description,
 * returned as a 0-100 percentage. Mirrors the intent of the Python
 * `compute_keyword_score` (TF-IDF cosine over the two documents).
 */
export function computeKeywordScore(resume: string, job: string): number {
  const resumeTokens = contentTokens(resume);
  const jobTokens = contentTokens(job);
  if (resumeTokens.length === 0 || jobTokens.length === 0) return 0;

  const tfResume = termFreq(resumeTokens);
  const tfJob = termFreq(jobTokens);

  // Document frequency across the two documents for IDF.
  const vocab = new Set<string>([...tfResume.keys(), ...tfJob.keys()]);
  const idf = new Map<string, number>();
  for (const term of vocab) {
    const df = (tfResume.has(term) ? 1 : 0) + (tfJob.has(term) ? 1 : 0);
    // Smoothed IDF (like sklearn's default) over N=2 documents.
    idf.set(term, Math.log((1 + 2) / (1 + df)) + 1);
  }

  let dot = 0;
  let magR = 0;
  let magJ = 0;
  for (const term of vocab) {
    const wR = (tfResume.get(term) ?? 0) * (idf.get(term) ?? 0);
    const wJ = (tfJob.get(term) ?? 0) * (idf.get(term) ?? 0);
    dot += wR * wJ;
    magR += wR * wR;
    magJ += wJ * wJ;
  }
  if (magR === 0 || magJ === 0) return 0;

  const cosine = dot / (Math.sqrt(magR) * Math.sqrt(magJ));
  return Math.round(Math.max(0, Math.min(1, cosine)) * 100);
}

export interface CloudWord {
  text: string;
  count: number;
  /** Normalized 0..1 weight relative to the most frequent word. */
  weight: number;
}

/**
 * Build a word-frequency list for a simple custom word cloud.
 * Returns up to `limit` words, sorted by frequency descending.
 */
export function buildWordCloud(text: string, limit = 40): CloudWord[] {
  const tokens = contentTokens(text).filter((w) => w.length > 2);
  if (tokens.length === 0) return [];

  const tf = termFreq(tokens);
  const sorted = [...tf.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = sorted[0]?.[1] ?? 1;
  const min = sorted[sorted.length - 1]?.[1] ?? 1;
  const range = Math.max(1, max - min);

  return sorted.map(([text, count]) => ({
    text,
    count,
    weight: (count - min) / range,
  }));
}

/**
 * Port of the Python `run_ats_checklist` rule-based checks.
 */
export function runAtsChecklist(resumeText: string): AtsCheck[] {
  const checks: AtsCheck[] = [];

  const wordCount = resumeText.trim() === "" ? 0 : resumeText.trim().split(/\s+/).length;
  checks.push({
    label: "Reasonable length",
    passed: wordCount >= 200 && wordCount <= 1000,
    detail: `${wordCount} words (ideal range: roughly 200–1000)`,
  });

  const hasEmail = /[\w.\-]+@[\w.\-]+\.\w+/.test(resumeText);
  checks.push({
    label: "Contains an email address",
    passed: hasEmail,
    detail: hasEmail
      ? "Found"
      : "Not found — make sure contact info is included",
  });

  const hasPhone = /(\+?\d[\d\-\s().]{8,}\d)/.test(resumeText);
  checks.push({
    label: "Contains a phone number",
    passed: hasPhone,
    detail: hasPhone ? "Found" : "Not found — consider adding one",
  });

  const sectionKeywords = ["experience", "education", "skills"];
  const lower = resumeText.toLowerCase();
  const foundSections = sectionKeywords.filter((s) => lower.includes(s));
  checks.push({
    label: "Has standard sections (Experience / Education / Skills)",
    passed: foundSections.length >= 2,
    detail: `Found: ${foundSections.length ? foundSections.join(", ") : "none detected"}`,
  });

  const hasBullets =
    resumeText.includes("•") || /^\s*[-*]\s/m.test(resumeText);
  checks.push({
    label: "Uses bullet points",
    passed: hasBullets,
    detail: hasBullets
      ? "Found"
      : "Consider using bullet points — many ATS and recruiters scan for them",
  });

  return checks;
}
