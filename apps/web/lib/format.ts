// Formatting helpers. The API stores naive UTC timestamps, so values without an
// explicit offset are treated as UTC and shown in India Standard Time.
const TZ = "Asia/Kolkata";
const LOCALE = "en-IN";

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(d);
}

export function formatDate(value: string | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatTime(value: string | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
}

/** "in 2 h 15 min", "45 min ago" */
export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  const d = parseApiDate(value);
  if (!d) return "—";
  const diff = d.getTime() - now;
  const mins = Math.round(Math.abs(diff) / 60000);
  let text: string;
  if (mins < 1) text = "less than a minute";
  else if (mins < 60) text = `${mins} min`;
  else if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    text = m ? `${h} h ${m} min` : `${h} h`;
  } else {
    const days = Math.round(mins / (60 * 24));
    text = `${days} day${days === 1 ? "" : "s"}`;
  }
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export function minutesUntil(value: string | null | undefined, now = Date.now()): number | null {
  const d = parseApiDate(value);
  return d ? Math.round((d.getTime() - now) / 60000) : null;
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 }).format(n);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, { month: "short" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

/** Convert a datetime-local input value (IST wall clock) to an ISO string in UTC. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
