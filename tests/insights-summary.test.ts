import { describe, expect, it } from "vitest";
import { summarizeInsights } from "@/lib/planner/insights";

const metric = (name: string, value: number) => ({ type: "engagement", name, value, unit: null });
const post = (over: Partial<Parameters<typeof summarizeInsights>[0][number]> = {}) => ({
  status: "published",
  buffer_post_id: "b1",
  insights: [] as ReturnType<typeof metric>[],
  insights_synced_at: null as string | null,
  ...over,
});

describe("summarizeInsights", () => {
  it("totals additive metrics across published posts that have synced insights", () => {
    const s = summarizeInsights([
      post({ insights: [metric("reactions", 10), metric("comments", 2)], insights_synced_at: "2026-09-21T10:00:00Z" }),
      post({ insights: [metric("Reactions", 5), metric("impressions", 300)], insights_synced_at: "2026-09-21T12:00:00Z" }),
    ]);
    expect(s.totals).toEqual([
      { name: "reactions", value: 15 },
      { name: "comments", value: 2 },
      { name: "impressions", value: 300 },
    ]);
    expect(s.syncedCount).toBe(2);
    expect(s.lastSyncedAt).toBe("2026-09-21T12:00:00Z");
  });

  it("does not total reach or rates, which are not additive", () => {
    const s = summarizeInsights([
      post({ insights: [metric("reach", 100), metric("engagementRate", 4.2), metric("reactions", 1)], insights_synced_at: "2026-09-21T10:00:00Z" }),
    ]);
    expect(s.totals).toEqual([{ name: "reactions", value: 1 }]);
  });

  it("counts Buffer-published posts separately from those with insights, and ignores unpublished or non-Buffer ones", () => {
    const s = summarizeInsights([
      post(),
      post({ status: "scheduled", insights: [metric("reactions", 99)], insights_synced_at: "2026-09-21T10:00:00Z" }),
      post({ buffer_post_id: null }), // e.g. a YouTube post — Buffer has no insights for it
    ]);
    expect(s.publishedCount).toBe(1);
    expect(s.syncedCount).toBe(0);
    expect(s.totals).toEqual([]);
    expect(s.lastSyncedAt).toBeNull();
  });
});
