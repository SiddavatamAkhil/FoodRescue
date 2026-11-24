import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { passwordChecks, passwordScore, SCORE_LABEL } from "@/lib/password";

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const colors = ["bg-line-strong", "bg-danger", "bg-warning", "bg-sage", "bg-forest"];
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", i <= score ? colors[score] : "bg-line")} />
          ))}
        </div>
        <span className="w-16 text-right text-xs font-semibold text-muted">{password ? SCORE_LABEL[score] : ""}</span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {passwordChecks(password).map((c) => (
          <li key={c.label} className={cn("flex items-center gap-1", c.ok ? "text-success-text" : "text-muted")}>
            {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
            {c.label}
            <span className="sr-only">{c.ok ? "(met)" : "(not met)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
