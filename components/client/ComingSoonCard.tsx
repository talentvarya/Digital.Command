import type { LucideIcon } from "lucide-react";

export function ComingSoonCard({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="card flex items-center justify-between opacity-75">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-ink-400" />
        <span className="font-medium text-ink-700">{title}</span>
      </div>
      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-500">
        Coming in next build phase
      </span>
    </div>
  );
}
