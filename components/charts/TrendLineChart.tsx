"use client";

import { useState } from "react";

export interface TrendPoint {
  date: string; // ISO date, already sorted ascending
  value: number;
}

// A single-series trend line, built to the dataviz skill's mark spec: 2px
// line, 4px rounded data-end anchored to the last point, recessive
// gridlines/axis, hover crosshair + tooltip. Renders nothing fancy when
// there isn't enough real history yet — this app never invents data points.
export function TrendLineChart({
  points,
  color = "#2a78d6",
  formatter = (v: number) => v.toLocaleString(),
  height = 160,
}: {
  points: TrendPoint[];
  color?: string;
  formatter?: (v: number) => string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-ink-200 text-xs text-ink-400">
        Not enough synced history yet for a trend — check back after another sync.
      </div>
    );
  }

  const width = 480;
  const padding = { top: 12, right: 12, bottom: 22, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) => padding.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => padding.top + innerH - ((v - min) / range) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(2)} ${padding.top + innerH} L ${x(0).toFixed(2)} ${padding.top + innerH} Z`;

  const gridY = [min, (min + max) / 2, max];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((relX - padding.left) / innerW) * (points.length - 1));
    setHoverIndex(Math.min(Math.max(idx, 0), points.length - 1));
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Trend chart"
      >
        {gridY.map((v, i) => (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={0} y={y(v) + 3} fontSize={10} fill="#898781">
              {formatter(Math.round(v))}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={color} fillOpacity={0.08} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={4} fill={color} />

        {hoverIndex !== null && (
          <line
            x1={x(hoverIndex)}
            x2={x(hoverIndex)}
            y1={padding.top}
            y2={padding.top + innerH}
            stroke="#c3c2b7"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {hoverIndex !== null && (
          <circle cx={x(hoverIndex)} cy={y(points[hoverIndex].value)} r={4} fill="white" stroke={color} strokeWidth={2} />
        )}

        <text x={padding.left} y={height - 4} fontSize={10} fill="#898781">
          {new Date(points[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
        <text x={width - padding.right} y={height - 4} fontSize={10} fill="#898781" textAnchor="end">
          {new Date(points[points.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-ink-100 bg-white px-2.5 py-1.5 text-xs shadow-md">
          <div className="font-medium text-ink-900">{formatter(hovered.value)}</div>
          <div className="text-ink-400">{new Date(hovered.date).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}
