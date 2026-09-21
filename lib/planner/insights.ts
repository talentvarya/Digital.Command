import type { ContentInsight } from "@/types/database";

// Only metrics that genuinely add up across posts are totalled. Reach (unique
// people) and rates such as engagementRate would be wrong or meaningless if
// summed, so they stay per-post on each card. Names are matched
// case-insensitively; anything a network reports under a different name simply
// isn't totalled here.
const ADDITIVE_METRICS = ["reactions", "likes", "comments", "shares", "clicks", "impressions", "saves", "views"];

interface InsightItem {
  status: string;
  buffer_post_id: string | null;
  insights: ContentInsight[];
  insights_synced_at: string | null;
}

export function summarizeInsights(items: InsightItem[]) {
  const published = items.filter((i) => i.status === "published" && i.buffer_post_id);
  const synced = published.filter((i) => i.insights_synced_at && i.insights.length > 0);

  const sums = new Map<string, number>();
  for (const item of synced) {
    for (const metric of item.insights) {
      const key = metric.name.toLowerCase();
      if (ADDITIVE_METRICS.includes(key) && Number.isFinite(metric.value)) {
        sums.set(key, (sums.get(key) ?? 0) + metric.value);
      }
    }
  }

  const lastSyncedAt = synced.reduce<string | null>(
    (latest, i) => (latest === null || (i.insights_synced_at as string) > latest ? (i.insights_synced_at as string) : latest),
    null
  );

  return {
    publishedCount: published.length,
    syncedCount: synced.length,
    totals: ADDITIVE_METRICS.filter((k) => sums.has(k)).map((name) => ({ name, value: sums.get(name) as number })),
    lastSyncedAt,
  };
}
