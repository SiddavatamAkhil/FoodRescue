import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChainStep = { title: string; detail?: React.ReactNode; meta?: React.ReactNode; state: "done" | "current" | "upcoming" | "stopped" };

/**
 * The FoodRescue custody chain: every rescue is a sequence of verified hand-offs.
 * Used for the product explainer and for each donation's live timeline.
 */
export function CustodyChain({ steps, className, compact = false }: { steps: ChainStep[]; className?: string; compact?: boolean }) {
  return (
    <ol className={cn("relative", className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.title} className={cn("relative flex gap-4", !last && (compact ? "pb-4" : "pb-6"))}>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 bottom-0 border-l-2",
                  s.state === "done" ? "border-forest" : "border-dashed border-line-strong",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                s.state === "done" && "border-forest bg-forest text-white",
                s.state === "current" && "border-forest bg-surface text-forest ring-4 ring-forest/10",
                s.state === "upcoming" && "border-line-strong bg-surface text-muted",
                s.state === "stopped" && "border-danger bg-danger-50 text-danger",
              )}
              aria-hidden
            >
              {s.state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold", s.state === "upcoming" ? "text-muted" : "text-ink", compact ? "text-sm" : "text-base")}>
                {s.title}
                <span className="sr-only"> — {s.state === "done" ? "completed" : s.state === "current" ? "in progress" : s.state === "stopped" ? "stopped" : "not started"}</span>
              </p>
              {s.detail && <div className={cn("mt-0.5 text-muted", compact ? "text-xs" : "text-sm")}>{s.detail}</div>}
              {s.meta && <div className="mt-1 text-xs text-muted tabular">{s.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
