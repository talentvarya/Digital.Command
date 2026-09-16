import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

export function ModuleLinkCard({
  icon: Icon,
  title,
  href,
  subtitle,
  color = "#2a78d6",
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <Link
      href={href}
      style={
        {
          "--module-color": color,
          backgroundColor: `${color}14`,
          borderColor: `${color}40`,
        } as React.CSSProperties
      }
      className="group flex min-h-[152px] flex-col justify-between gap-4 rounded-2xl border-2 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-400 transition group-hover:translate-x-1 group-hover:text-[color:var(--module-color)]" />
      </div>
      <div>
        <div className="text-base font-semibold text-ink-900">{title}</div>
        {subtitle && <div className="mt-1.5 text-sm leading-snug text-ink-600">{subtitle}</div>}
      </div>
    </Link>
  );
}
