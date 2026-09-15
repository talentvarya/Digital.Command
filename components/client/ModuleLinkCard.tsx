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
      style={{ "--module-color": color } as React.CSSProperties}
      className="card group flex items-center justify-between transition hover:-translate-y-0.5 hover:border-[color:var(--module-color)] hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition group-hover:bg-[color:var(--module-color)] group-hover:text-white"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-ink-800">{title}</div>
          {subtitle && <div className="text-xs text-ink-500">{subtitle}</div>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
    </Link>
  );
}
