import { cn } from "@/lib/cn";

/** Bordered content region. Use for grouped content, not for every number. */
export function Panel({ children, className, as: Tag = "section", ...rest }: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("rounded-md border border-line bg-surface", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHeader({ title, description, action, className }: { title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-md font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function PanelBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/** A single row of key figures separated by rules (instead of a grid of identical cards). */
export function StatStrip({ items, className }: { items: { label: string; value: React.ReactNode; note?: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 overflow-hidden rounded-md border border-line bg-surface md:grid-cols-4", className)}>
      {items.map((it, i) => (
        <div key={it.label} className={cn("px-5 py-4", i > 0 && "border-line md:border-l", i % 2 === 1 && "border-l", i >= 2 && "border-t md:border-t-0")}>
          <dt className="text-sm text-muted">{it.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular">{it.value}</dd>
          {it.note && <dd className="mt-0.5 text-xs text-muted">{it.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function KeyValue({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-2.5 text-sm">
          <dt className="text-muted">{it.label}</dt>
          <dd className="min-w-0 break-words text-ink">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
