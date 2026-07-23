export interface ScoreStyle {
  hex: string;
  /** Tailwind classes for a solid badge/pill. */
  badge: string;
  /** Tailwind classes for a soft/tinted surface. */
  soft: string;
  /** Text color class. */
  text: string;
  label: string;
}

/**
 * Map a 1-10 fit score to a red -> amber -> green style bucket.
 */
export function scoreColor(score: number): ScoreStyle {
  if (score >= 8) {
    return {
      hex: "#16a34a",
      badge: "bg-emerald-600 text-white",
      soft: "bg-emerald-50 ring-emerald-200",
      text: "text-emerald-700",
      label: "Strong fit",
    };
  }
  if (score >= 6) {
    return {
      hex: "#65a30d",
      badge: "bg-lime-600 text-white",
      soft: "bg-lime-50 ring-lime-200",
      text: "text-lime-700",
      label: "Good fit",
    };
  }
  if (score >= 4) {
    return {
      hex: "#d97706",
      badge: "bg-amber-500 text-white",
      soft: "bg-amber-50 ring-amber-200",
      text: "text-amber-700",
      label: "Partial fit",
    };
  }
  return {
    hex: "#dc2626",
    badge: "bg-red-600 text-white",
    soft: "bg-red-50 ring-red-200",
    text: "text-red-700",
    label: "Weak fit",
  };
}

/** Style buckets for the free keyword-match percentage (0-100). */
export function keywordColor(pct: number): { hex: string; text: string } {
  if (pct >= 60) return { hex: "#16a34a", text: "text-emerald-700" };
  if (pct >= 35) return { hex: "#d97706", text: "text-amber-700" };
  return { hex: "#dc2626", text: "text-red-700" };
}
