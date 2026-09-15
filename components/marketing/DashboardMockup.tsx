import { TrendingUp } from "lucide-react";

const STATS = [
  { label: "Organic Clicks", value: "3,412", delta: "+12.4%" },
  { label: "Sessions", value: "5,208", delta: "+6.7%" },
  { label: "Audit Events", value: "1,940", delta: "logged" },
];

const QUEUE = [
  { title: "IG carousel", mode: "Approval Required" },
  { title: "FB weekend post", mode: "Autopilot" },
  { title: "Google campaign", mode: "Manual Launch Required" },
];

// Illustrative mock — not a client's real data. Purely a hero visual, never
// wired to anything live.
export function DashboardMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Command Center</span>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 [font-variant-numeric:tabular-nums]">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg bg-white/[0.03] p-3">
            <div className="text-[10px] uppercase tracking-wide text-white/40">{s.label}</div>
            <div className="mt-1 font-mono text-lg font-semibold text-white">{s.value}</div>
            <div className="text-[10px] text-cyan-400">{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-lg bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-white/60">
          <TrendingUp className="h-3.5 w-3.5" />
          Organic performance — Search Console
        </div>
        <svg viewBox="0 0 200 40" className="h-10 w-full" preserveAspectRatio="none">
          <polyline
            points="0,32 30,28 60,30 90,18 120,20 150,10 180,12 200,4"
            fill="none"
            stroke="url(#grad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3d5afe" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="space-y-1.5">
        {QUEUE.map((item) => (
          <div key={item.title} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
            <span className="text-white/80">{item.title}</span>
            <span className="text-white/40">{item.mode}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
