import { cn } from "@/lib/cn";
import { FOOD_CATEGORIES } from "@/lib/places";

export function CategoryPicker({ value, onChange, legend, error }: { value: string[]; onChange: (v: string[]) => void; legend: string; error?: string }) {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {FOOD_CATEGORIES.map((c) => {
          const on = value.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.value)}
              className={cn(
                "h-9 rounded border px-3 text-sm font-semibold transition-colors",
                on ? "border-forest bg-forest-50 text-forest" : "border-line-strong bg-surface text-muted hover:text-ink",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-sm font-medium text-danger-text">{error}</p>}
    </fieldset>
  );
}
