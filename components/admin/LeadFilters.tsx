import Link from "next/link";
import { Search } from "lucide-react";
import type { LeadStatus } from "@/types/database";

const STATUS_OPTIONS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "not_interested", label: "Not interested" },
];

// URL-param-driven, same pattern as WindowSelector — no client JS needed,
// filtering happens server-side in page.tsx off searchParams.
export function LeadFilters({ status, q }: { status: string; q: string }) {
  function hrefFor(nextStatus: string) {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/leads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form method="GET" action="/admin/leads" className="flex items-center gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search name, business, phone…"
            className="field-input w-56 py-1.5 pl-8 text-sm"
          />
        </div>
        <button type="submit" className="btn-secondary px-3 py-1.5 text-sm">
          Search
        </button>
        {q && (
          <Link href={hrefFor(status)} className="text-xs text-ink-400 hover:text-ink-600">
            Clear
          </Link>
        )}
      </form>

      <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white">
        {STATUS_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={hrefFor(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium ${
              status === opt.value ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
