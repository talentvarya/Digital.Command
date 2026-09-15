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
    default: { bg: "bg-brand-50", text: "text-brand-600", bar: "bg-brand-500" },
    warning: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
    success: { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500" },
    danger: { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-500" },
  }[tone];

  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-ink-100 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${toneStyles.bar}`} />
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneStyles.bg} ${toneStyles.text}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-ink-900 [font-variant-numeric:tabular-nums]">{value}</div>
        <div className="text-sm text-ink-500">{label}</div>
      </div>
    </div>
  );
}
