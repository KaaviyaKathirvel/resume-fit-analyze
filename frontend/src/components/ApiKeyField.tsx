import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

interface ApiKeyFieldProps {
  apiKey: string;
  onChange: (key: string) => void;
  compact?: boolean;
}

export function ApiKeyField({ apiKey, onChange, compact }: ApiKeyFieldProps) {
  const [reveal, setReveal] = useState(false);
  const hasKey = apiKey.trim().length > 0;

  return (
    <div className={cn(compact ? "w-full" : "w-full max-w-md")}>
      <label htmlFor="api-key" className="label-base flex items-center gap-1.5">
        <KeyRound className="h-4 w-4 text-slate-400" />
        OpenAI API key
        {hasKey && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> saved
          </span>
        )}
      </label>
      <div className="relative flex items-center">
        <input
          id="api-key"
          type={reveal ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          spellCheck={false}
          className="input-base pr-20"
        />
        <div className="absolute right-1.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label={reveal ? "Hide key" : "Show key"}
          >
            {reveal ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          {hasKey && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              aria-label="Clear key"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Stored only in your browser (localStorage). Sent only to the two
        AI-powered features, never saved on any server.
      </p>
    </div>
  );
}

interface ApiKeyButtonProps {
  hasKey: boolean;
  onClick: () => void;
}

export function ApiKeyButton({ hasKey, onClick }: ApiKeyButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      icon={<KeyRound className="h-4 w-4" />}
    >
      <span className="hidden sm:inline">
        {hasKey ? "API key" : "Add API key"}
      </span>
      <span
        className={cn(
          "ml-1 inline-block h-2 w-2 rounded-full",
          hasKey ? "bg-emerald-500" : "bg-amber-400"
        )}
        aria-hidden="true"
      />
    </Button>
  );
}
