import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-500/40 disabled:bg-brand-300",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 shadow-sm hover:bg-slate-50 focus-visible:ring-brand-500/40 disabled:text-slate-400",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-brand-500/40 disabled:text-slate-300",
  danger:
    "bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 focus-visible:ring-red-500/40 disabled:text-red-300",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-base gap-2",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold transition",
        "focus:outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}
