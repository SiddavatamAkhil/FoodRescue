import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";
const styles: Record<Tone, { box: string; icon: React.ElementType }> = {
  info: { box: "bg-info-50 border-info/20 text-ink", icon: Info },
  success: { box: "bg-success-50 border-success/20 text-ink", icon: CheckCircle2 },
  warning: { box: "bg-warning-50 border-warning/30 text-ink", icon: AlertTriangle },
  danger: { box: "bg-danger-50 border-danger/25 text-ink", icon: XCircle },
};
const iconColor: Record<Tone, string> = { info: "text-info", success: "text-success", warning: "text-warning-text", danger: "text-danger" };

export function Alert({ tone = "info", title, children, action, className }: { tone?: Tone; title?: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const Icon = styles[tone].icon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm", styles[tone].box, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-ink-soft")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: React.ElementType; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-forest-50 text-forest">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="text-md font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-5 py-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-5 py-8">
      <Alert tone="danger" title="Couldn't load this section" action={onRetry ? (
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-forest hover:underline">Try again</button>
      ) : undefined}>
        {message}
      </Alert>
    </div>
  );
}
