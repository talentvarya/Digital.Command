import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ListChecks } from "lucide-react";
import type { AttentionItem, AttentionTone } from "@/lib/dashboard/command-center";

// Each tone is told apart by icon and label as well as colour, so it doesn't
// depend on seeing red versus amber.
const TONE: Record<AttentionTone, { icon: typeof Info; ring: string; badge: string; label: string }> = {
  urgent: { icon: AlertTriangle, ring: "border-red-200 bg-red-50/60", badge: "text-red-700", label: "Fix now" },
  todo: { icon: ListChecks, ring: "border-amber-200 bg-amber-50/60", badge: "text-amber-800", label: "To do" },
  info: { icon: Info, ring: "border-ink-200 bg-ink-50", badge: "text-ink-600", label: "Tip" },
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="card flex items-center gap-3 border-emerald-200 bg-emerald-50/60">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
        <div>
          <h2 className="text-base font-semibold text-emerald-900">All clear</h2>
          <p className="text-sm text-emerald-800">Nothing needs you right now — Digital Command is on it.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink-900">
        Needs your attention <span className="ml-1 text-sm font-medium text-ink-400">({items.length})</span>
      </h2>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const tone = TONE[item.tone];
          const Icon = tone.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`group flex items-center gap-4 rounded-xl border p-4 transition hover:shadow-sm ${tone.ring}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${tone.badge}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone.badge}`}>{tone.label}</div>
                  <div className="text-base font-semibold text-ink-900">{item.title}</div>
                  <div className="text-sm text-ink-600">{item.detail}</div>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-ink-800 sm:inline-flex">
                  {item.cta}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-400 sm:hidden" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
