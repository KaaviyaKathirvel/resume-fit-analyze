import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant =
  | "brand"
  | "green"
  | "slate"
  | "amber"
  | "red"
  | "outline";

const variants: Record<Variant, string> = {
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  slate: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  outline: "bg-white text-slate-600 ring-1 ring-inset ring-slate-200",
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = "slate", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
