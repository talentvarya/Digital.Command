import Link from "next/link";
import { PLANNER_WINDOW_OPTIONS, type PlannerWindow } from "@/lib/constants/content";

export function WindowSelector({ current }: { current: PlannerWindow }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Plan for</span>
      <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white">
        {PLANNER_WINDOW_OPTIONS.map((n) => (
          <Link
            key={n}
            href={`/app/planner?days=${n}`}
            className={`px-3 py-1.5 text-sm font-medium ${
              current === n ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50"
            }`}
          >
            {n}d
          </Link>
        ))}
      </div>
    </div>
  );
}
