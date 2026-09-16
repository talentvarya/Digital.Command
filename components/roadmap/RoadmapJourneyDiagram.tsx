import { ArrowRight, ArrowDown, Check } from "lucide-react";
import type { RoadmapPhase } from "@/types/database";

interface FlowBox {
  done: boolean;
  border: string;
  bg: string;
  text: string;
  title: string;
}

const PALETTE = [
  { border: "border-cyan-400/40", bg: "bg-cyan-400/10", text: "text-cyan-300" },
  { border: "border-brand-400/40", bg: "bg-brand-400/10", text: "text-brand-300" },
  { border: "border-amber-400/40", bg: "bg-amber-400/10", text: "text-amber-300" },
  { border: "border-rose-400/40", bg: "bg-rose-400/10", text: "text-rose-300" },
];

// A real flowchart — boxes connected by arrows, one direction, left to
// right (top to bottom on phone) — not a stepper, not a chart. Matches the
// same box+arrow language used in the earlier planning-doc process
// diagrams (e.g. "without / with Digital Command").
export function RoadmapJourneyDiagram({ phases, readyLabel }: { phases: RoadmapPhase[]; readyLabel: string }) {
  const boxes: FlowBox[] = [
    { done: true, border: "border-emerald-400/50", bg: "bg-emerald-400/10", text: "text-emerald-300", title: readyLabel },
    ...phases.slice(0, 4).map((p, i) => ({ done: false, ...PALETTE[i], title: p.title })),
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {/* Horizontal, sm and up */}
      <div className="hidden items-stretch sm:flex">
        {boxes.map((box, i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div className={`flex min-h-[64px] w-full items-center justify-center rounded-xl border px-3 py-2.5 text-center ${box.bg} ${box.border}`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold leading-snug ${box.text}`}>
                {box.done && <Check className="h-3.5 w-3.5 shrink-0" />}
                {box.title}
              </div>
            </div>
            {i < boxes.length - 1 && <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-white/25" />}
          </div>
        ))}
      </div>

      {/* Vertical, below sm */}
      <div className="flex flex-col sm:hidden">
        {boxes.map((box, i) => (
          <div key={i}>
            <div className={`flex min-h-[56px] items-center justify-center rounded-xl border px-3 py-2.5 text-center ${box.bg} ${box.border}`}>
              <div className={`flex items-center gap-1.5 text-sm font-bold leading-snug ${box.text}`}>
                {box.done && <Check className="h-4 w-4 shrink-0" />}
                {box.title}
              </div>
            </div>
            {i < boxes.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-white/25" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
