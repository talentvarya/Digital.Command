import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_PHOTO_DAILY_LIMIT_PER_ORG,
  AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT,
  checkAiPhotoQuota,
  platformDailyLimit,
  recordCreativeGeneration,
  utcDayStart,
} from "@/lib/creative/quota";

afterEach(() => vi.unstubAllEnvs());

// Stands in for the service-role client: answers the two usage counts and records inserts.
function fakeService(counts: { org: number; platform: number } | "error") {
  const inserts: Record<string, unknown>[] = [];
  const filters: { table: string; eq: [string, unknown][]; gte: [string, unknown][] }[] = [];
  const client = {
    from: (table: string) => {
      const state = { table, eq: [] as [string, unknown][], gte: [] as [string, unknown][] };
      filters.push(state);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          state.eq.push([col, val]);
          return builder;
        },
        gte: (col: string, val: unknown) => {
          state.gte.push([col, val]);
          return builder;
        },
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { error: counts === "error" ? { message: "no table" } : null };
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            counts === "error"
              ? { count: null, error: { message: "relation does not exist" } }
              : { count: state.eq.some(([c]) => c === "org_id") ? counts.org : counts.platform, error: null }
          ),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, inserts, filters };
}

describe("daily AI photo quota", () => {
  it("lets a business with room left generate", async () => {
    const { client } = fakeService({ org: 3, platform: 40 });
    expect(await checkAiPhotoQuota(client, "org-1")).toEqual({ ok: true });
  });

  it("stops a business at its own daily share and says when it resets", async () => {
    const { client } = fakeService({ org: AI_PHOTO_DAILY_LIMIT_PER_ORG, platform: 40 });
    const result = await checkAiPhotoQuota(client, "org-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/5:30 AM IST/);
  });

  it("stops everyone when the shared platform allowance is reached", async () => {
    const { client } = fakeService({ org: 0, platform: AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT });
    const result = await checkAiPhotoQuota(client, "org-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/shared free AI photo allowance/);
  });

  it("fails CLOSED when usage can't be counted, so the free allowance can't be burned blindly", async () => {
    const { client } = fakeService("error");
    const result = await checkAiPhotoQuota(client, "org-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/isn't set up yet/);
  });

  it("counts only today's AI photos (UTC day), for this business and for the platform", async () => {
    const { client, filters } = fakeService({ org: 0, platform: 0 });
    await checkAiPhotoQuota(client, "org-7", new Date("2026-09-26T23:59:59Z"));
    expect(filters).toHaveLength(2);
    for (const f of filters) {
      expect(f.table).toBe("creative_generations");
      expect(f.eq).toContainEqual(["kind", "ai_photo"]);
      expect(f.gte).toEqual([["created_at", "2026-09-26T00:00:00.000Z"]]);
    }
    expect(filters.filter((f) => f.eq.some(([c, v]) => c === "org_id" && v === "org-7"))).toHaveLength(1);
  });

  it("starts the day at 00:00 UTC (5:30 AM IST), when Cloudflare's allowance resets", () => {
    expect(utcDayStart(new Date("2026-09-26T05:29:00Z")).toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-09-26T00:00:00Z")).toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  it("lets the platform limit be raised with CREATIVE_AI_DAILY_LIMIT and ignores nonsense", () => {
    expect(platformDailyLimit({})).toBe(AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT);
    expect(platformDailyLimit({ CREATIVE_AI_DAILY_LIMIT: "500" })).toBe(500);
    expect(platformDailyLimit({ CREATIVE_AI_DAILY_LIMIT: "12.9" })).toBe(12);
    expect(platformDailyLimit({ CREATIVE_AI_DAILY_LIMIT: "abc" })).toBe(AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT);
    expect(platformDailyLimit({ CREATIVE_AI_DAILY_LIMIT: "-5" })).toBe(AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT);
  });
});

describe("recordCreativeGeneration", () => {
  it("writes one row describing the graphic", async () => {
    const { client, inserts } = fakeService({ org: 0, platform: 0 });
    const ok = await recordCreativeGeneration(client, {
      orgId: "org-1",
      contentItemId: "item-1",
      userId: "user-1",
      kind: "ai_photo",
      provider: "cloudflare-flux",
      style: "offer",
    });
    expect(ok).toBe(true);
    expect(inserts).toEqual([
      { org_id: "org-1", content_item_id: "item-1", created_by: "user-1", kind: "ai_photo", provider: "cloudflare-flux", style: "offer" },
    ]);
  });

  it("reports failure instead of throwing", async () => {
    const { client } = fakeService("error");
    expect(
      await recordCreativeGeneration(client, { orgId: "o", contentItemId: "i", userId: "u", kind: "template", provider: "satori", style: "tip" })
    ).toBe(false);
  });
});
