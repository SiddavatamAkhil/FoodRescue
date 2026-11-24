"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

// Chart palette validated for colour-vision deficiency and contrast (light surface).
export const SERIES = { listed: "#5B8DC9", rescued: "#16855A" } as const;

type Series = { key: string; label: string; color: string; values: number[] };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/**
 * Vertical bar chart for one or two series over ordered categories (e.g. months).
 * Includes a legend for 2+ series, per-group hover/focus tooltip and a table view.
 */
export function BarChart({
  categories, series, unit, title, height = 220,
}: { categories: string[]; series: Series[]; unit: string; title: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  // Render at the container's real pixel width so text stays 11px at every screen size.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const ticks = [0, max / 2, max];
  const H = height;
  const pad = { l: 44, r: 8, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / categories.length;
  const gap = 2;
  const barW = Math.min(28, (band * 0.62 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  return (
    <figure aria-labelledby={`${id}-t`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption id={`${id}-t`} className="text-sm font-semibold">{title}</figcaption>
        <div className="flex items-center gap-4">
          {series.length > 1 && (
            <ul className="flex gap-4 text-xs text-muted" aria-label="Legend">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />{s.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setTable((t) => !t)} className="text-xs font-semibold text-forest hover:underline" aria-pressed={table}>
            {table ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2 pr-4 font-semibold">Period</th>{series.map((s) => <th key={s.key} className="py-2 pr-4 text-right font-semibold">{s.label} ({unit})</th>)}</tr></thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c} className="border-b border-line last:border-0"><td className="py-2 pr-4">{c}</td>{series.map((s) => <td key={s.key} className="py-2 pr-4 text-right tabular">{formatNumber(s.values[i], 1)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={box}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`${title}. Use "Show table" for the values.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E4E9E3" strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">{formatNumber(t)}</text>
              </g>
            ))}
            {categories.map((c, i) => {
              const gx = pad.l + band * i + (band - groupW) / 2;
              return (
                <g key={c}>
                  {hover === i && <rect x={pad.l + band * i + 2} y={pad.t} width={band - 4} height={ih} fill="#174C3C" opacity={0.05} rx={4} />}
                  {series.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    const h = Math.max(0, pad.t + ih - y(v));
                    const x = gx + si * (barW + gap);
                    const r = Math.min(4, barW / 2, h);
                    // Rounded data-end, square baseline.
                    const d = h <= 0 ? "" : `M${x},${pad.t + ih} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) + r} V${pad.t + ih} Z`;
                    return d ? <path key={s.key} d={d} fill={s.color} /> : null;
                  })}
                  {(categories.length <= 6 || W >= 520 || (categories.length - 1 - i) % 2 === 0) && (
                    <text x={pad.l + band * i + band / 2} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">{c}</text>
                  )}
                  <rect
                    x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" tabIndex={0} role="img"
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                    aria-label={`${c}: ${series.map((s) => `${s.label} ${formatNumber(s.values[i], 1)} ${unit}`).join(", ")}`}
                    className="outline-none"
                  />
                </g>
              );
            })}
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="#CDD5CE" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded border border-line bg-surface px-3 py-2 text-xs shadow-pop"
              style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%` }}
              role="presentation"
            >
              <p className="mb-1 font-semibold">{categories[hover]}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5 whitespace-nowrap text-ink-soft">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                  {s.label}: <span className="font-semibold text-ink tabular">{formatNumber(s.values[hover], 1)} {unit}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for a single measure across a few labelled rows, values labelled directly. */
export function BarList({ rows, unit, title, color = SERIES.rescued }: { rows: { label: string; value: number }[]; unit: string; title: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure>
      <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-ink-soft">{r.label}</span>
            <span className="h-2.5 rounded-r bg-canvas" aria-hidden>
              <span className={cn("block h-full rounded-r")} style={{ width: `${(r.value / max) * 100}%`, background: color, minWidth: r.value > 0 ? 3 : 0 }} />
            </span>
            <span className="w-20 text-right font-semibold tabular">{formatNumber(r.value, 1)} <span className="font-normal text-muted">{unit}</span></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
