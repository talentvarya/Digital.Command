import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export function MetricBar({
  label,
  current,
  previous,
  higherIsBetter = true,
  formatter = (v: number) => v.toLocaleString(),
}: {
  label: string;
  current: number;
  previous: number | null;
  higherIsBetter?: boolean;
  formatter?: (v: number) => string;
}) {
  const max = Math.max(current, previous ?? 0, 1);
  const currentWidth = (current / max) * 100;
  const previousWidth = previous !== null ? (previous / max) * 100 : 0;

  const delta = previous !== null ? current - previous : null;
  const improved = delta !== null && (higherIsBetter ? delta > 0 : delta < 0);
  const declined = delta !== null && (higherIsBetter ? delta < 0 : delta > 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{label}</span>
        <span className="flex items-center gap-1 font-medium text-ink-800">
          {formatter(current)}
          {delta !== null &&
            (improved ? (
              <ArrowUp className="h-3 w-3 text-emerald-600" />
            ) : declined ? (
              <ArrowDown className="h-3 w-3 text-red-600" />
            ) : (
              <Minus className="h-3 w-3 text-ink-400" />
            ))}
        </span>
      </div>
      <div className="h-2 rounded-full bg-ink-100">
        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${currentWidth}%` }} />
      </div>
      {previous !== null && (
        <div className="h-1.5 rounded-full bg-ink-50">
          <div className="h-1.5 rounded-full bg-ink-300" style={{ width: `${previousWidth}%` }} />
        </div>
      )}
      {previous !== null && <div className="text-[11px] text-ink-400">Previous: {formatter(previous)}</div>}
    </div>
  );
}
