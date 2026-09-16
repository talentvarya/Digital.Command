import { Check } from "lucide-react";
import type { RoadmapPhase } from "@/types/database";

interface Step {
  done: boolean;
  label: string;
}

function Node({ step, index }: { step: Step; index: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-bold ${
          step.done ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
        }`}
      >
        {step.done ? <Check className="h-5 w-5" /> : index}
      </div>
      <div className="mt-2 max-w-[110px] text-xs font-semibold leading-snug text-white sm:max-w-[140px]">{step.label}</div>
    </div>
  );
}

// The visual "journey" — a connected line of nodes from "roadmap ready" to
// each phase, so the same 5 steps the text below spells out in bullets also
// read at a glance as a single picture. Horizontal on wider screens, a
// vertical version at phone width where 5 nodes in a row would get too
// cramped to read.
export function RoadmapJourneyDiagram({ phases, readyLabel }: { phases: RoadmapPhase[]; readyLabel: string }) {
  const steps: Step[] = [{ done: true, label: readyLabel }, ...phases.map((p) => ({ done: false, label: p.title }))];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {/* Horizontal, sm and up */}
      <div className="hidden items-start sm:flex">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-1 items-start last:flex-none">
            <Node step={step} index={i + 1} />
            {i < steps.length - 1 && (
              <div
                className={`mt-[22px] h-0.5 flex-1 ${step.done ? "bg-gradient-to-r from-emerald-400 to-cyan-400/60" : "bg-gradient-to-r from-cyan-400/40 to-cyan-400/10"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Vertical, below sm */}
      <div className="space-y-0 sm:hidden">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold ${
                  step.done ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-0.5 flex-1 ${step.done ? "bg-emerald-400/40" : "bg-cyan-400/20"}`} style={{ minHeight: 28 }} />}
            </div>
            <div className="pb-4 pt-1.5">
              <div className="text-sm font-semibold leading-snug text-white">{step.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
