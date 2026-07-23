import { useEffect, useState } from "react";
import { checkHealth } from "../api";
import { cn } from "../lib/cn";

type Status = "checking" | "online" | "offline";

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function ping() {
      try {
        const res = await checkHealth(controller.signal);
        if (!cancelled) setStatus(res.status === "ok" ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }
    ping();
    const interval = setInterval(ping, 30_000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const config: Record<Status, { label: string; dot: string; text: string }> = {
    checking: { label: "Checking…", dot: "bg-slate-300", text: "text-slate-500" },
    online: { label: "Backend online", dot: "bg-emerald-500", text: "text-slate-600" },
    offline: { label: "Backend offline", dot: "bg-red-500", text: "text-slate-600" },
  };
  const c = config[status];

  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 sm:flex"
      title={c.label}
    >
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          c.dot,
          status === "checking" && "animate-pulse"
        )}
      />
      <span className={cn("text-xs font-medium", c.text)}>{c.label}</span>
    </div>
  );
}
