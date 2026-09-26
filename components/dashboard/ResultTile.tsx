import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { formatPercent, percentChange, sparklinePath } from "@/lib/dashboard/command-center";

const SPARK_W = 120;
const SPARK_H = 36;
const SPARK_PAD = 3;

// One number that matters, with how it moved and (when there's a real history)
// a small trend line. When nothing has been measured yet it says so plainly and
// points at the page that fixes it — never a made-up zero.
export function ResultTile({
  icon: Icon,
  label,
  color,
  href,
  display,
  current,
  previous,
  higherIsBetter = true,
  caption,
  trend,
  emptyText,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  href: string;
  // The headline number as text ("1,240", "72/100"); null = nothing measured yet.
  display: string | null;
  // The same number raw, and the reading before it — what the change is worked out from.
  current?: number | null;
  previous?: number | null;
  higherIsBetter?: boolean;
  caption?: string | null;
  trend?: number[];
  emptyText: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl border border-ink-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-ink-600">{label}</span>
      </div>

      {display === null ? (
        <p className="text-sm leading-relaxed text-ink-500">{emptyText}</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="text-3xl font-bold leading-none text-ink-900 [font-variant-numeric:tabular-nums]">{display}</div>
            <Spark values={trend ?? []} color={color} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
            <Delta current={current ?? null} previous={previous ?? null} higherIsBetter={higherIsBetter} />
            {caption && <span>{caption}</span>}
          </div>
        </>
      )}
    </Link>
  );
}

function Delta({ current, previous, higherIsBetter }: { current: number | null; previous: number | null; higherIsBetter: boolean }) {
  if (current === null) return null;
  const pct = percentChange(current, previous);
  const text = formatPercent(pct);
  if (pct === null || text === null) return null;
  const flat = text === "no change";
  const good = higherIsBetter ? pct > 0 : pct < 0;
  const tone = flat ? "bg-ink-50 text-ink-600" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  const Arrow = flat ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${tone}`}>
      <Arrow className="h-3 w-3" aria-hidden="true" />
      {text}
      <span className="sr-only"> compared with the period before</span>
    </span>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const path = sparklinePath(values, SPARK_W, SPARK_H, SPARK_PAD);
  if (!path) return null;
  // The end dot sits where the line does: same scale as sparklinePath().
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const endX = SPARK_W - SPARK_PAD;
  const endY = SPARK_PAD + (SPARK_H - SPARK_PAD * 2) * (1 - (values[values.length - 1] - min) / range);
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0"
      role="img"
      aria-label={`Trend over the last ${values.length} readings`}
    >
      <path d={`${path} L${endX} ${SPARK_H} L${SPARK_PAD} ${SPARK_H} Z`} fill={color} fillOpacity="0.1" stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={endX} cy={endY} r="3" fill={color} />
    </svg>
  );
}
