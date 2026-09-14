import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

export function ModuleLinkCard({ icon: Icon, title, href, subtitle }: { icon: LucideIcon; title: string; href: string; subtitle?: string }) {
  return (
    <Link href={href} className="card flex items-center justify-between transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-brand-600" />
        <div>
          <div className="font-medium text-ink-800">{title}</div>
          {subtitle && <div className="text-xs text-ink-500">{subtitle}</div>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-300" />
    </Link>
  );
}
