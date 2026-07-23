import { Sparkles, ShieldCheck } from "lucide-react";
import { Badge } from "./Badge";

/** Marks a section that spends the user's own OpenAI credit. */
export function PaidBadge() {
  return (
    <Badge variant="brand">
      <Sparkles className="h-3.5 w-3.5" />
      Uses your OpenAI credit
    </Badge>
  );
}

/** Marks a section that runs entirely in the browser at no cost. */
export function FreeBadge() {
  return (
    <Badge variant="green">
      <ShieldCheck className="h-3.5 w-3.5" />
      Free · runs in your browser
    </Badge>
  );
}
