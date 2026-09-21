import type { SupabaseClient } from "@supabase/supabase-js";
import { createBufferPost } from "@/lib/buffer/client";
import { uploadYoutubeVideo } from "@/lib/youtube/client";
import { getValidAccessToken } from "@/lib/google/oauth";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { resolveDueAt } from "@/lib/publishing/schedule";
import type { ContentItem, ContentPlatform } from "@/types/database";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const PAST_MESSAGE = "The scheduled time has already passed — reschedule it to a future time, then send again.";

// What actually happened, so a caller (e.g. the "Send now" button) can tell the
// client something useful instead of guessing from the row afterwards.
export type PublishOutcome =
  | { outcome: "sent" }
  | { outcome: "no_channel" }
  | { outcome: "not_connected" }
  | { outcome: "paused"; message: string }
  | { outcome: "past" }
  | { outcome: "skipped" }
  | { outcome: "error"; message: string };

// The "Social Publishing Adapter" seam documented since Phase 1
// (ARCHITECTURE.md) — its first real implementation. Called whenever a
// content_item reaches status='scheduled' (client approval or Autopilot
// auto-schedule, both in app/app/planner/actions.ts). Never throws — a
// missing/broken connection is a normal, expected state (not every org has
// linked a channel yet), so failures are recorded on the row, not surfaced
// as an action error.
//
// skipIfPast is for bulk re-dispatch (flushPendingPublishing): an old item
// whose time has gone is left untouched there instead of being flagged as an
// error on every pass. A single explicit send always reports it.
export async function dispatchToPublisher(
  supabase: SupabaseClient,
  item: ContentItem,
  options: { skipIfPast?: boolean } = {}
): Promise<PublishOutcome> {
  const automation = await checkAutomationAllowed(supabase, item.org_id);
  if (!automation.allowed) return { outcome: "paused", message: automation.reason }; // publish_status stays untouched

  const due = resolveDueAt(item);
  if (!due.ok) {
    if (options.skipIfPast) return { outcome: "skipped" };
    await recordError(supabase, item.id, PAST_MESSAGE);
    return { outcome: "past" };
  }

  try {
    if (item.platform === "facebook" || item.platform === "instagram") {
      return await dispatchToBuffer(supabase, item, due.dueAt);
    }
    if (item.platform === "youtube") {
      return await dispatchToYoutube(supabase, item, due.dueAt);
    }
    return { outcome: "skipped" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    await recordError(supabase, item.id, message);
    return { outcome: "error", message };
  }
}

async function recordError(supabase: SupabaseClient, itemId: string, message: string) {
  await supabase.from("content_items").update({ publish_status: "error", publish_error: message }).eq("id", itemId);
}

// Posts approved BEFORE a channel was linked (the normal order at onboarding)
// or during a Master STOP sit at publish_status='not_sent' and nothing ever
// picked them up again. This sends them: called when an admin links a Buffer
// channel, and available on demand. Only future-dated, still-scheduled items.
export async function flushPendingPublishing(
  supabase: SupabaseClient,
  orgId: string,
  platform?: ContentPlatform
): Promise<{ attempted: number; sent: number }> {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("content_items")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "scheduled")
    .eq("publish_status", "not_sent")
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
    .limit(50);
  if (platform) query = query.eq("platform", platform);

  const { data } = await query;
  let sent = 0;
  for (const item of (data ?? []) as ContentItem[]) {
    const result = await dispatchToPublisher(supabase, item, { skipIfPast: true });
    if (result.outcome === "sent") sent += 1;
  }
  return { attempted: data?.length ?? 0, sent };
}

async function dispatchToBuffer(supabase: SupabaseClient, item: ContentItem, dueAt: string): Promise<PublishOutcome> {
  const { data: link } = await supabase
    .from("buffer_channel_links")
    .select("buffer_channel_id")
    .eq("org_id", item.org_id)
    .eq("platform", item.platform)
    .maybeSingle();

  if (!link) return { outcome: "no_channel" }; // not an error, just unconfigured

  const { data: media } = await supabase
    .from("content_media")
    .select("media_type, storage_path")
    .eq("content_item_id", item.id);

  const assetUrls: { type: "image" | "video"; url: string }[] = [];
  for (const m of media ?? []) {
    const { data: signed } = await supabase.storage
      .from("content-media")
      .createSignedUrl(m.storage_path, SEVEN_DAYS_SECONDS);
    if (signed?.signedUrl) assetUrls.push({ type: m.media_type, url: signed.signedUrl });
  }

  // Instagram has no text-only feed post; sending one just earns an opaque
  // rejection from Buffer, so say what's actually missing.
  if (item.platform === "instagram" && assetUrls.length === 0) {
    const message = "Instagram needs an image or video — add one to this post, then send it again.";
    await recordError(supabase, item.id, message);
    return { outcome: "error", message };
  }

  const text = item.hashtags.length ? `${item.caption ?? ""}\n\n${item.hashtags.map((h) => `#${h}`).join(" ")}` : item.caption ?? "";

  const post = await createBufferPost({ channelId: link.buffer_channel_id, text, dueAt, assetUrls });

  await supabase
    .from("content_items")
    .update({ buffer_post_id: post.id, publish_status: "sent", publish_error: null })
    .eq("id", item.id);

  await logAudit(supabase, {
    orgId: item.org_id,
    actorUserId: item.created_by,
    actorRole: "client_owner",
    source: item.source === "ai_generated" ? "AUTOPILOT" : "CLIENT_MANUAL",
    actionType: "sent_to_buffer",
    target: item.id,
    newState: { bufferPostId: post.id },
  });
  return { outcome: "sent" };
}

async function dispatchToYoutube(supabase: SupabaseClient, item: ContentItem, publishAt: string): Promise<PublishOutcome> {
  const accessToken = await getValidAccessToken(supabase, item.org_id, "youtube");
  if (!accessToken) return { outcome: "not_connected" }; // not connected yet — not an error

  const { data: media } = await supabase
    .from("content_media")
    .select("storage_path")
    .eq("content_item_id", item.id)
    .eq("media_type", "video")
    .limit(1)
    .maybeSingle();

  if (!media) {
    const message = "No video file attached to this item.";
    await recordError(supabase, item.id, message);
    return { outcome: "error", message };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("content-media")
    .download(media.storage_path);
  if (downloadError || !file) throw new Error(`Could not read the video file: ${downloadError?.message ?? "unknown error"}`);

  const result = await uploadYoutubeVideo({
    accessToken,
    videoBytes: await file.arrayBuffer(),
    mimeType: file.type || "video/mp4",
    title: (item.caption ?? "Untitled").slice(0, 100),
    description: item.hashtags.length ? `${item.caption ?? ""}\n\n${item.hashtags.map((h) => `#${h}`).join(" ")}` : item.caption ?? "",
    publishAt,
  });

  await supabase
    .from("content_items")
    .update({ youtube_video_id: result.videoId, publish_status: "sent", publish_error: null })
    .eq("id", item.id);

  await logAudit(supabase, {
    orgId: item.org_id,
    actorUserId: item.created_by,
    actorRole: "client_owner",
    source: item.source === "ai_generated" ? "AUTOPILOT" : "CLIENT_MANUAL",
    actionType: "uploaded_to_youtube",
    target: item.id,
    newState: { youtubeVideoId: result.videoId },
  });
  return { outcome: "sent" };
}
