import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const toneStyles = {
    default: "bg-brand-50 text-brand-600",
    warning: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-red-50 text-red-600",
  }[tone];

  return (
    <div className="card flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneStyles}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-ink-900">{value}</div>
        <div className="text-sm text-ink-500">{label}</div>
      </div>
    </div>
  );
}
