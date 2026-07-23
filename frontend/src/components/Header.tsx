import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { ApiKeyButton, ApiKeyField } from "./ApiKeyField";
import { BackendStatus } from "./BackendStatus";

interface HeaderProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export function Header({ apiKey, onApiKeyChange }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
              Resume <span className="text-brand-600">↔</span> Job Fit
            </p>
            <p className="hidden text-xs text-slate-500 sm:block">
              Match, analyze &amp; tailor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <BackendStatus />
          <div className="relative" ref={panelRef}>
            <ApiKeyButton
              hasKey={apiKey.trim().length > 0}
              onClick={() => setOpen((v) => !v)}
            />
            {open && (
              <div className="absolute right-0 top-full mt-2 w-[min(92vw,24rem)] animate-fade-in rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <ApiKeyField
                  apiKey={apiKey}
                  onChange={onApiKeyChange}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
