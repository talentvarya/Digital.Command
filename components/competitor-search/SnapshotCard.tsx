import { Trophy } from "lucide-react";
import type { ApifySearchSnapshot } from "@/types/database";

export function SnapshotCard({ snapshot }: { snapshot: ApifySearchSnapshot }) {
  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">&quot;{snapshot.query}&quot;</span>
        <span className="text-xs text-ink-400">{new Date(snapshot.run_at).toLocaleString()}</span>
      </div>

      {snapshot.own_domain && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Trophy className={`h-4 w-4 ${snapshot.own_domain_position ? "text-amber-500" : "text-ink-300"}`} />
          {snapshot.own_domain_position ? (
            <span className="text-ink-700">
              You ({snapshot.own_domain}) ranked <strong>#{snapshot.own_domain_position}</strong>
            </span>
          ) : (
            <span className="text-ink-500">{snapshot.own_domain} didn&apos;t appear in the top results.</span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {snapshot.top_results.map((r) => (
          <div key={r.position} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold text-ink-400 [font-variant-numeric:tabular-nums]">
              #{r.position}
            </span>
            <div className="min-w-0 flex-1">
              <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                {r.title}
              </a>
              <div className="truncate text-xs text-ink-400">{r.domain}</div>
            </div>
          </div>
        ))}
        {snapshot.top_results.length === 0 && <p className="text-sm text-ink-400">No organic results returned.</p>}
      </div>
    </div>
  );
}
