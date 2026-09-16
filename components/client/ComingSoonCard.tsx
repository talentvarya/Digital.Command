import type { LucideIcon } from "lucide-react";

export function ComingSoonCard({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex min-h-[152px] flex-col justify-between gap-4 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 p-5 opacity-75">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-500">Coming soon</span>
      </div>
      <div className="text-base font-semibold text-ink-700">{title}</div>
    </div>
  );
}
