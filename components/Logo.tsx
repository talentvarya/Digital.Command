import { Radar } from "lucide-react";

export function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Radar className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="text-lg font-bold tracking-tight text-ink-900">
          DIGITAL <span className="text-brand-600">COMMAND</span>
        </div>
        {subtitle && <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
          AI Digital Marketing Autopilot
        </div>}
      </div>
    </div>
  );
}
