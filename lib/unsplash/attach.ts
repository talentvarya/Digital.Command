import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchUnsplashPhoto, trackUnsplashDownload } from "@/lib/unsplash/client";

// Downloads the top Unsplash match for `query` and attaches it as
// content_media on `contentItemId`, the same bucket/shape a client's own
// manual upload uses (see lib/supabase/upload.ts) — so it flows through
// dispatchToPublisher exactly like any other attached image.
//
// Deliberately swallows every failure (missing key, no results, network
// error): an auto-attached photo is a nice-to-have on top of the caption
// that already succeeded, never a reason to fail the whole generation.
export async function attachUnsplashPhoto(
  supabase: SupabaseClient,
  params: { orgId: string; contentItemId: string; query: string }
): Promise<void> {
  try {
    const found = await searchUnsplashPhoto(params.query);
    if (!found) return;

    const imageRes = await fetch(found.imageUrl);
    if (!imageRes.ok) return;
    const bytes = new Uint8Array(await imageRes.arrayBuffer());

    const path = `${params.orgId}/${randomUUID()}-unsplash.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("content-media")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (uploadError) return;

    await supabase.from("content_media").insert({
      content_item_id: params.contentItemId,
      org_id: params.orgId,
      media_type: "image",
      storage_path: path,
    });

    await trackUnsplashDownload(found.downloadLocation);
  } catch {
    // best-effort — see module comment
  }
}

// Keeps the Unsplash query short and free of hashtags/punctuation/emoji —
// long sentences return worse matches than a few plain keywords.
export function captionToImageQuery(caption: string, platform: string): string {
  const words = caption
    .replace(/#\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return words.length ? words.join(" ") : `${platform} social media post`;
}
