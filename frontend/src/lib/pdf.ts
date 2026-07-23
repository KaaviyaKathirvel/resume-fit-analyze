import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Wire up the worker via a Vite-resolvable URL so the build bundles it.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * Extract plain text from a PDF file entirely in the browser.
 * Joins per-page text and preserves rough line breaks.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];

    for (const item of content.items) {
      const t = item as TextItem;
      if (t.str === undefined) continue;
      const y = t.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trimEnd());
        line = "";
      }
      line += t.str;
      if (t.hasEOL) {
        lines.push(line.trimEnd());
        line = "";
      }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trimEnd());
    pages.push(lines.join("\n"));
  }

  return pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
