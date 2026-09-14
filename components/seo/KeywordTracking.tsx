import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { SearchConsoleSnapshot } from "@/types/database";

export function KeywordTracking({
  latest,
  previous,
}: {
  latest: SearchConsoleSnapshot | null;
  previous: SearchConsoleSnapshot | null;
}) {
  if (!latest) {
    return <p className="text-sm text-ink-400">Connect and sync Search Console to see keyword tracking.</p>;
  }

  const previousByQuery = new Map((previous?.top_queries ?? []).map((q) => [q.query, q]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-400">
            <th className="py-2 pr-4">Query</th>
            <th className="py-2 pr-4">Clicks</th>
            <th className="py-2 pr-4">Impressions</th>
            <th className="py-2 pr-4">Position</th>
            <th className="py-2">Trend</th>
          </tr>
        </thead>
        <tbody>
          {latest.top_queries.map((row) => {
            const prev = previousByQuery.get(row.query);
            const delta = prev ? prev.position - row.position : 0; // positive = improved (lower number is better)
            return (
              <tr key={row.query} className="border-b border-ink-50 last:border-0">
                <td className="py-1.5 pr-4 text-ink-800">{row.query}</td>
                <td className="py-1.5 pr-4 text-ink-600">{row.clicks}</td>
                <td className="py-1.5 pr-4 text-ink-600">{row.impressions}</td>
                <td className="py-1.5 pr-4 text-ink-600">{row.position.toFixed(1)}</td>
                <td className="py-1.5">
                  {!prev ? (
                    <span className="text-xs text-ink-400">new</span>
                  ) : delta > 0.5 ? (
                    <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                      <ArrowUp className="h-3 w-3" /> {delta.toFixed(1)}
                    </span>
                  ) : delta < -0.5 ? (
                    <span className="flex items-center gap-0.5 text-xs text-red-600">
                      <ArrowDown className="h-3 w-3" /> {Math.abs(delta).toFixed(1)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-xs text-ink-400">
                      <Minus className="h-3 w-3" />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
