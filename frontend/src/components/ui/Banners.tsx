import type { ReactNode } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({
  title = "Something went wrong",
  message,
  onDismiss,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-red-700">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="rounded p-1 text-red-500 transition hover:bg-red-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function InfoNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600",
        className
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>{children}</div>
    </div>
  );
}
