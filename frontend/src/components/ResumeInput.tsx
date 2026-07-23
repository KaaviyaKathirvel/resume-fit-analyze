import { useRef, useState } from "react";
import { FileUp, FileText, Loader2, Type, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { ErrorBanner } from "./ui/Banners";
import { extractPdfText } from "../lib/pdf";
import { cn } from "../lib/cn";

interface ResumeInputProps {
  resumeText: string;
  onChange: (text: string) => void;
}

type Mode = "upload" | "paste";

export function ResumeInput({ resumeText, onChange }: ResumeInputProps) {
  const [mode, setMode] = useState<Mode>("paste");
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordCount =
    resumeText.trim() === "" ? 0 : resumeText.trim().split(/\s+/).length;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        setError(
          "No selectable text found in this PDF. It may be a scanned image — try pasting the text instead."
        );
        onChange("");
      } else {
        onChange(text);
      }
    } catch {
      setError("Could not read that PDF. Try pasting the text instead.");
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Your résumé
          </h2>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
          <ModeTab
            active={mode === "paste"}
            onClick={() => setMode("paste")}
            icon={<Type className="h-4 w-4" />}
            label="Paste text"
          />
          <ModeTab
            active={mode === "upload"}
            onClick={() => setMode("upload")}
            icon={<FileUp className="h-4 w-4" />}
            label="Upload PDF"
          />
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        {error && (
          <ErrorBanner
            title="Upload problem"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {mode === "upload" ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
                dragging
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {parsing ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
                  <p className="text-sm font-medium text-slate-700">
                    Reading {fileName}…
                  </p>
                </>
              ) : (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    Drop your PDF here, or{" "}
                    <span className="text-brand-600">browse</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Parsed privately in your browser — nothing is uploaded.
                  </p>
                </>
              )}
            </div>

            {fileName && !parsing && resumeText.trim() && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="truncate text-sm text-slate-700">
                    {fileName}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {wordCount} words
                  </span>
                </div>
                <button
                  onClick={() => {
                    setFileName(null);
                    onChange("");
                  }}
                  className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {resumeText.trim() && (
              <div>
                <p className="label-base">Extracted text preview</p>
                <textarea
                  value={resumeText}
                  onChange={(e) => onChange(e.target.value)}
                  rows={8}
                  className="input-base resize-y font-mono text-xs leading-relaxed"
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="resume-text" className="label-base">
              Paste your résumé text
            </label>
            <textarea
              id="resume-text"
              value={resumeText}
              onChange={(e) => onChange(e.target.value)}
              rows={12}
              placeholder="Paste the full text of your résumé here…"
              className="input-base resize-y leading-relaxed"
            />
            <div className="mt-1.5 flex justify-end">
              <span className="text-xs text-slate-400">{wordCount} words</span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-white text-brand-700 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
