import type { RoadmapPhase } from "@/types/database";

interface JourneyNode {
  dot: string;
  bg: string;
  text: string;
  border: string;
  title: string;
  sub: string;
}

// Fixed layout for a fixed node count (1 "ready" node + exactly 4 phases,
// per generate-roadmap.ts's system prompt) — positions tuned by eye, not
// computed, same as the earlier planning-doc growth diagrams this mirrors.
const NODE_X = [8, 29, 50, 71, 92];
const NODE_Y = [80, 62, 44, 26, 12];
const LABEL_BELOW = [true, true, false, false, false];

const PALETTE = [
  { dot: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { dot: "#06b6d4", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  { dot: "#2a78d6", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { dot: "#eb6834", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  { dot: "#e11d48", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
];

// An ascending "growth" line, not a plain stepper — the same visual
// language as the planning-doc growth diagrams (colored dot per stage,
// dashed leader to a tinted label card, line rising left to right). Sits as
// a bright card inside the otherwise dark /roadmap page, a deliberate
// contrast for the one chart on the page rather than another dark panel.
export function RoadmapJourneyDiagram({ phases, readyLabel }: { phases: RoadmapPhase[]; readyLabel: string }) {
  const nodes: JourneyNode[] = [
    { ...PALETTE[0], title: readyLabel, sub: "" },
    ...phases.slice(0, 4).map((p, i) => ({ ...PALETTE[i + 1], title: p.title, sub: p.timeframe })),
  ];

  const linePoints = nodes.map((_, i) => `${NODE_X[i]},${NODE_Y[i]}`).join(" ");

  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-7">
      <div className="relative" style={{ paddingBottom: "58%" }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`Growth journey from ${readyLabel} through ${nodes.length - 1} phases`}
        >
          <defs>
            <marker id="rj-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#2a78d6" />
            </marker>
          </defs>
          <polyline
            points={linePoints}
            fill="none"
            stroke="#2a78d6"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            markerEnd="url(#rj-arrow)"
          />
          {nodes.map((n, i) => {
            const labelY = LABEL_BELOW[i] ? NODE_Y[i] + 16 : NODE_Y[i] - 16;
            return (
              <line
                key={i}
                x1={NODE_X[i]}
                x2={NODE_X[i]}
                y1={NODE_Y[i]}
                y2={labelY}
                stroke={n.dot}
                strokeOpacity={0.4}
                strokeWidth="1"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {nodes.map((n, i) => (
            <circle key={i} cx={NODE_X[i]} cy={NODE_Y[i]} r="2.3" fill={n.dot} />
          ))}
        </svg>

        {nodes.map((n, i) => (
          <div
            key={i}
            className={`absolute w-[26%] rounded-lg border px-2 py-1.5 text-center sm:w-[22%] ${n.bg} ${n.border}`}
            style={{
              left: `${NODE_X[i]}%`,
              top: `${LABEL_BELOW[i] ? NODE_Y[i] + 20 : NODE_Y[i] - 20}%`,
              transform: `translate(-50%, ${LABEL_BELOW[i] ? "0%" : "-100%"})`,
            }}
          >
            <div className={`text-[10px] font-bold leading-tight sm:text-xs ${n.text}`}>{n.title}</div>
            {n.sub && <div className={`text-[9px] leading-tight opacity-80 sm:text-[10px] ${n.text}`}>{n.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
