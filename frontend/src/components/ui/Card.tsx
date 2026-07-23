import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("border-b border-slate-100 px-5 py-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("px-5 py-5 sm:px-6", className)}>{children}</div>;
}
