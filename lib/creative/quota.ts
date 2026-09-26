import type { SupabaseClient } from "@supabase/supabase-js";

// Daily limits on AI photos. They exist so the shared FREE Cloudflare allowance
// can never be exhausted by one client: each business gets a share, and the
// platform total stays safely under the free plan's real capacity (~170+ a day).
// Counting uses creative_generations, which only the server can write to (no
// client insert policy), so a client can't fake usage to block others.
// Raise the platform limit with CREATIVE_AI_DAILY_LIMIT after upgrading the plan.
export const AI_PHOTO_DAILY_LIMIT_PER_ORG = 20;
export const AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT = 150;

export function platformDailyLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.CREATIVE_AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : AI_PHOTO_DAILY_LIMIT_PLATFORM_DEFAULT;
}

// Cloudflare's allowance resets at 00:00 UTC, so count from then.
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type QuotaResult = { ok: true } | { ok: false; message: string };

// Fails CLOSED: if usage can't be counted (e.g. the table isn't there yet), no AI
// photo is made, because an unchecked run could burn the shared allowance.
export async function checkAiPhotoQuota(service: SupabaseClient, orgId: string, now: Date = new Date()): Promise<QuotaResult> {
  const since = utcDayStart(now).toISOString();
  const countAiPhotos = () =>
    service.from("creative_generations").select("id", { count: "exact", head: true }).eq("kind", "ai_photo").gte("created_at", since);

  const [org, platform] = await Promise.all([countAiPhotos().eq("org_id", orgId), countAiPhotos()]);
  if (org.error || platform.error || org.count === null || platform.count === null) {
    return {
      ok: false,
      message: "AI photo usage tracking isn't set up yet — ask your Digital Command contact to apply the latest database update.",
    };
  }
  if (org.count >= AI_PHOTO_DAILY_LIMIT_PER_ORG) {
    return {
      ok: false,
      message: `You've used today's ${AI_PHOTO_DAILY_LIMIT_PER_ORG} free AI photos — more tomorrow (5:30 AM IST). Brand-colour and stock-photo graphics have no limit.`,
    };
  }
  if (platform.count >= platformDailyLimit()) {
    return {
      ok: false,
      message: "Today's shared free AI photo allowance is used up — try again after 5:30 AM IST. Brand-colour and stock-photo graphics still work.",
    };
  }
  return { ok: true };
}

export interface GenerationRecord {
  orgId: string;
  contentItemId: string;
  userId: string;
  kind: "template" | "ai_photo";
  provider: string;
  style: string;
}

// Best effort for graphics without an AI photo (nothing to protect there); the
// caller decides how to treat a failure for AI photos.
export async function recordCreativeGeneration(service: SupabaseClient, r: GenerationRecord): Promise<boolean> {
  const { error } = await service.from("creative_generations").insert({
    org_id: r.orgId,
    content_item_id: r.contentItemId,
    created_by: r.userId,
    kind: r.kind,
    provider: r.provider,
    style: r.style,
  });
  return !error;
}
