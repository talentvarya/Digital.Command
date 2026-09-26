import { MONTHS, percentChange } from "@/lib/dashboard/command-center";

// Wording and number formats for the downloadable report. Pure, and deliberately
// plain ASCII where a symbol could be missing from the report's font.

export type ChangeTone = "good" | "bad" | "flat";
export interface Change {
  text: string;
  tone: ChangeTone;
}

// 1234567 → "12,34,567" — Indian digit grouping, done by hand so it doesn't
// depend on the server's locale data.
export function formatCount(value: number): string {
  const digits = String(Math.round(Math.abs(value)));
  const sign = value < 0 ? "-" : "";
  if (digits.length <= 3) return sign + digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}${head},${digits.slice(-3)}`;
}

function dayLabel(date: string): { day: number; month: string; year: number } | null {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear() };
}

// "26 Aug – 25 Sep 2026", or with both years when the period crosses New Year.
// The en dash is in the report's font; if a date can't be read the raw text is used.
export function formatPeriod(start: string, end: string): string {
  const a = dayLabel(start);
  const b = dayLabel(end);
  if (!a || !b) return `${start} – ${end}`;
  if (a.year === b.year) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
}

export function formatDate(date: string): string {
  const d = dayLabel(date.slice(0, 10));
  return d ? `${d.day} ${d.month} ${d.year}` : date;
}

// The length of a period as it was asked for: a report for "the last 30 days"
// starts 30 days before it ends, so this is the gap between the two dates.
export function periodDays(start: string, end: string): number | null {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 86_400_000);
}

// "+23%", "-4.3%" or "No change"; null when there's no earlier figure to compare with.
export function changeLabel(current: number, previous: number | null, higherIsBetter = true): Change | null {
  const pct = percentChange(current, previous);
  if (pct === null) return null;
  if (Math.abs(pct) < 0.5) return { text: "No change", tone: "flat" };
  const text = `${pct > 0 ? "+" : "-"}${Math.abs(pct).toFixed(Math.abs(pct) >= 10 ? 0 : 1)}%`;
  const better = higherIsBetter ? pct > 0 : pct < 0;
  return { text, tone: better ? "good" : "bad" };
}

// A score out of 100 moves in points, not percent: "+5 points".
export function pointsChange(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) return { text: "No change", tone: "flat" };
  return { text: `${diff > 0 ? "+" : "-"}${Math.abs(diff)} ${Math.abs(diff) === 1 ? "point" : "points"}`, tone: diff > 0 ? "good" : "bad" };
}

// Search position: a smaller number is better, so "up 1.8 places" means it improved.
export function positionChange(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  const moved = previous - current;
  if (Math.abs(moved) < 0.05) return { text: "No change", tone: "flat" };
  const places = Math.abs(moved).toFixed(1);
  return moved > 0 ? { text: `Up ${places} places`, tone: "good" } : { text: `Down ${places} places`, tone: "bad" };
}

// A file name that is safe on every system: letters, digits and dashes only.
export function reportFileName(businessName: string, start: string, end: string): string {
  const slug = businessName
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "Business"}-marketing-report-${start}-to-${end}.pdf`;
}
