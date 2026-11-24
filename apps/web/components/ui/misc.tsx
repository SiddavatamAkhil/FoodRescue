import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions, breadcrumbs }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {breadcrumbs.map((b, i) => (
              <li key={b.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                {b.href ? <Link href={b.href} className="hover:text-ink hover:underline">{b.label}</Link> : <span aria-current="page" className="text-ink">{b.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-base text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Lightweight tooltip using native focus/hover; content is also exposed to screen readers. */
export function Tip({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[16rem] -translate-x-1/2 rounded bg-ink px-2 py-1 text-xs text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-md font-semibold", className)}>{children}</h2>;
}
