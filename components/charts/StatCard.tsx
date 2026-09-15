import { ArrowUp, ArrowDown, Minus, type LucideIcon } from "lucide-react";

// Fixed categorical order (never cycled/reassigned per-render) — the
// dataviz skill's validated default palette, CVD-safe adjacent pairs.
export const CHART_COLORS = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  violet: "#4a3aa7",
} as const;

// Named distinctly from components/StatCard.tsx (that one is a semantic
// tone-based tile — default/warning/success/danger — used for admin counts;
// this one is a categorical-color metric tile with a current/previous delta,
// per the dataviz skill's identity-vs-status color separation).
export function MetricStatCard({
  icon: Icon,
  label,
  current,
  previous,
  higherIsBetter = true,
  formatter = (v: number) => v.toLocaleString(),
  color = CHART_COLORS.blue,
}: {
  icon: LucideIcon;
  label: string;
  current: number;
  previous: number | null;
  higherIsBetter?: boolean;
  formatter?: (v: number) => string;
  color?: string;
}) {
  const delta = previous !== null && previous !== 0 ? ((current - previous) / previous) * 100 : null;
  const improved = delta !== null && (higherIsBetter ? delta > 0 : delta < 0);
  const declined = delta !== null && (higherIsBetter ? delta < 0 : delta > 0);

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 [font-variant-numeric:tabular-nums]">
        <span className="text-2xl font-bold text-ink-900">{formatter(current)}</span>
        {delta !== null && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              improved ? "bg-emerald-50 text-emerald-700" : declined ? "bg-red-50 text-red-700" : "bg-ink-50 text-ink-500"
            }`}
          >
            {improved ? <ArrowUp className="h-3 w-3" /> : declined ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {previous !== null && <div className="mt-1 text-[11px] text-ink-400">Previous: {formatter(previous)}</div>}
    </div>
  );
}
