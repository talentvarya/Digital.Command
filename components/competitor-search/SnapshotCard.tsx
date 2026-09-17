import { Trophy, Star, Phone, Globe } from "lucide-react";
import type { ApifySearchSnapshot } from "@/types/database";

export function SnapshotCard({ snapshot }: { snapshot: ApifySearchSnapshot }) {
  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">
          &quot;{snapshot.query}&quot; <span className="font-normal text-ink-400">near {snapshot.country_code}</span>
        </span>
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

      <div className="space-y-2.5">
        {snapshot.top_results.map((r) => (
          <div key={r.rank} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold text-ink-400 [font-variant-numeric:tabular-nums]">
              #{r.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink-900">{r.businessName}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                {r.category && <span>{r.category}</span>}
                {r.rating !== null && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {r.rating} ({r.reviewsCount ?? 0})
                  </span>
                )}
                {r.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {r.phone}
                  </span>
                )}
                {r.website && (
                  <a href={r.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-700 hover:underline">
                    <Globe className="h-3 w-3" /> {r.domain}
                  </a>
                )}
              </div>
              {r.address && <div className="mt-0.5 truncate text-xs text-ink-400">{r.address}</div>}
            </div>
          </div>
        ))}
        {snapshot.top_results.length === 0 && <p className="text-sm text-ink-400">No results returned.</p>}
      </div>
    </div>
  );
}
