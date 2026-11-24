import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Responsive table: a real <table> on wide screens; each row stacks into a labelled
 * block on narrow screens (labels come from data-label on each cell).
 */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm [&_td]:align-top">{children}</table>
    </div>
  );
}

export function THead({ columns }: { columns: { label: string; className?: string; srOnly?: boolean }[] }) {
  return (
    <thead className="hidden border-b border-line bg-canvas/70 md:table-header-group">
      <tr>
        {columns.map((c) => (
          <th key={c.label} scope="col" className={cn("px-5 py-2.5 text-left text-xs font-semibold text-muted", c.className)}>
            {c.srOnly ? <span className="sr-only">{c.label}</span> : c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TR({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "block border-b border-line px-5 py-3 last:border-b-0 md:table-row md:p-0",
        onClick && "cursor-pointer hover:bg-canvas/70",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <td data-label={label} className={cn("flex gap-3 py-1 md:table-cell md:px-5 md:py-3", className)}>
      <span className="w-28 shrink-0 text-xs font-semibold text-muted md:hidden">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </td>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm" aria-label="Pagination">
      <p className="text-muted tabular">{from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="inline-flex h-8 items-center gap-1 rounded border border-line-strong bg-surface px-2.5 font-semibold disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="px-2 text-muted tabular">Page {page} of {pages}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="inline-flex h-8 items-center gap-1 rounded border border-line-strong bg-surface px-2.5 font-semibold disabled:opacity-40" aria-label="Next page">
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-muted/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/25"
      />
    </div>
  );
}

export function FilterTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm font-semibold transition-colors",
            value === o.value ? "bg-forest-50 text-forest" : "text-muted hover:bg-canvas hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="tabular text-xs opacity-80">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
