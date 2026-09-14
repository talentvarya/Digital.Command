import type { SupabaseClient } from "@supabase/supabase-js";
import { createBufferPost } from "@/lib/buffer/client";
import { uploadYoutubeVideo } from "@/lib/youtube/client";
import { getValidAccessToken } from "@/lib/google/oauth";
import { logAudit } from "@/lib/audit/log";
import type { ContentItem } from "@/types/database";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

// The "Social Publishing Adapter" seam documented since Phase 1
// (ARCHITECTURE.md) — its first real implementation. Called whenever a
// content_item reaches status='scheduled' (client approval or Autopilot
// auto-schedule, both in app/app/planner/actions.ts). Never throws — a
// missing/broken connection is a normal, expected state (not every org has
// linked a channel yet), so failures are recorded on the row, not surfaced
// as an action error.
export async function dispatchToPublisher(supabase: SupabaseClient, item: ContentItem): Promise<void> {
  try {
    if (item.platform === "facebook" || item.platform === "instagram") {
      await dispatchToBuffer(supabase, item);
    } else if (item.platform === "youtube") {
      await dispatchToYoutube(supabase, item);
    }
  } catch (err) {
    await supabase
      .from("content_items")
      .update({
        publish_status: "error",
        publish_error: err instanceof Error ? err.message : "Publish failed",
      })
      .eq("id", item.id);
  }
}

async function dispatchToBuffer(supabase: SupabaseClient, item: ContentItem): Promise<void> {
  const { data: link } = await supabase
    .from("buffer_channel_links")
    .select("buffer_channel_id")
    .eq("org_id", item.org_id)
    .eq("platform", item.platform)
    .maybeSingle();

  if (!link) return; // no channel linked yet — not an error, just unconfigured

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

  const dueAt = item.scheduled_time
    ? `${item.scheduled_date}T${item.scheduled_time}:00.000Z`
    : `${item.scheduled_date}T09:00:00.000Z`;
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
}

async function dispatchToYoutube(supabase: SupabaseClient, item: ContentItem): Promise<void> {
  const accessToken = await getValidAccessToken(supabase, item.org_id, "youtube");
  if (!accessToken) return; // not connected yet — not an error

  const { data: media } = await supabase
    .from("content_media")
    .select("storage_path")
    .eq("content_item_id", item.id)
    .eq("media_type", "video")
    .limit(1)
    .maybeSingle();

  if (!media) {
    await supabase
      .from("content_items")
      .update({ publish_status: "error", publish_error: "No video file attached to this item." })
      .eq("id", item.id);
    return;
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("content-media")
    .download(media.storage_path);
  if (downloadError || !file) throw new Error(`Could not read the video file: ${downloadError?.message ?? "unknown error"}`);

  const publishAt = item.scheduled_time
    ? `${item.scheduled_date}T${item.scheduled_time}:00.000Z`
    : `${item.scheduled_date}T09:00:00.000Z`;

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
}
