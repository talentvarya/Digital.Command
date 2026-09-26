import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CloudflareImageError, cloudflareImageConfigured, generateFluxImage } from "@/lib/creative/cloudflare";
import { graphicBlockedReason } from "@/lib/creative/eligibility";
import { buildImagePrompt } from "@/lib/creative/prompt";
import { checkAiPhotoQuota, recordCreativeGeneration } from "@/lib/creative/quota";
import { renderCreativeJpeg, type CreativeSpec } from "@/lib/creative/render";
import {
  CREATIVE_SIZES,
  cleanOverlayText,
  creativeStoragePath,
  defaultSizeFor,
  deriveCreativeText,
  isReplaceableMedia,
  pickStyle,
  toDataUrl,
  type CreativeBackground,
  type CreativeSize,
  type CreativeStyle,
} from "@/lib/creative/spec";
import { captionToImageQuery } from "@/lib/unsplash/attach";
import { searchUnsplashPhoto, trackUnsplashDownload } from "@/lib/unsplash/client";
import type { ContentPlatform } from "@/types/database";

// Makes one post graphic and attaches it to a planner post. The heavy lifting
// (drawing, an AI photo, a stock photo) is injected through `deps` so the flow
// itself — quota checks, fallbacks, replacing the old picture — is testable
// without the network or a renderer.

export interface CreateCreativeInput {
  orgId: string;
  userId: string;
  contentItemId: string;
  style: CreativeStyle | "auto";
  // "auto" (used by the batch button) tries an AI photo, then a stock photo, then
  // plain brand colours, quietly moving on when one isn't available. An explicit
  // choice reports its own failure instead of silently substituting.
  background: CreativeBackground | "auto";
  size: CreativeSize | "auto";
}

export interface CreativeDeps {
  aiConfigured: () => boolean;
  generateAiImage: (prompt: string) => Promise<Uint8Array>;
  findStockPhoto: (query: string) => Promise<Uint8Array | null>;
  render: (spec: CreativeSpec) => Promise<Uint8Array>;
  now: () => Date;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const res = await fetch(url);
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

export const defaultDeps: CreativeDeps = {
  aiConfigured: () => cloudflareImageConfigured(),
  generateAiImage: (prompt) => generateFluxImage(prompt),
  findStockPhoto: async (query) => {
    const found = await searchUnsplashPhoto(query);
    if (!found) return null;
    const bytes = await fetchBytes(found.imageUrl);
    if (bytes) await trackUnsplashDownload(found.downloadLocation);
    return bytes;
  },
  render: renderCreativeJpeg,
  now: () => new Date(),
};

export type CreateCreativeResult = { error: string } | { ok: true; background: CreativeBackground; style: CreativeStyle };

// What appears on offer graphics: the business's WhatsApp, else its phone.
function contactLine(brand: { whatsapp: string | null; phone: string | null } | null): string | null {
  const whatsapp = cleanOverlayText(brand?.whatsapp ?? "").slice(0, 28);
  if (whatsapp) return `WhatsApp ${whatsapp}`;
  const phone = cleanOverlayText(brand?.phone ?? "").slice(0, 28);
  return phone ? `Call ${phone}` : null;
}

export async function createCreative(
  supabase: SupabaseClient, // the member's own session — row-level security applies
  service: SupabaseClient, // server-only: shared usage counts and the usage log
  input: CreateCreativeInput,
  deps: CreativeDeps = defaultDeps
): Promise<CreateCreativeResult> {
  const { orgId, contentItemId } = input;

  const { data: item } = await supabase
    .from("content_items")
    .select("id, platform, caption, status, locked, publish_status, scheduled_date, scheduled_time")
    .eq("id", contentItemId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!item) return { error: "Post not found." };
  const blocked = graphicBlockedReason(item);
  if (blocked) return { error: blocked };

  const [{ data: brand }, { data: org }] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("colors, logo_path, image_style, business_description, products_services, phone, whatsapp, words_to_avoid")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase.from("organizations").select("legal_name").eq("id", orgId).maybeSingle(),
  ]);

  const businessName = cleanOverlayText(org?.legal_name ?? "").slice(0, 34) || "Your business";
  const style: CreativeStyle = input.style === "auto" ? pickStyle(item.caption) : input.style;
  const size: CreativeSize = input.size === "auto" ? defaultSizeFor(item.platform as ContentPlatform) : input.size;
  const { headline, subline } = deriveCreativeText(item.caption, style, businessName);

  // --- background -----------------------------------------------------------
  let background: CreativeBackground = "colors";
  let backgroundBytes: Uint8Array | null = null;
  let aiUsed = false;
  const wanted = input.background;

  if (wanted === "ai" || wanted === "auto") {
    if (!deps.aiConfigured()) {
      if (wanted === "ai") return { error: "AI photos aren't switched on for this account yet — ask your Digital Command contact." };
    } else {
      const quota = await checkAiPhotoQuota(service, orgId, deps.now());
      if (!quota.ok) {
        if (wanted === "ai") return { error: quota.message };
      } else {
        try {
          backgroundBytes = await deps.generateAiImage(
            buildImagePrompt({
              headline,
              businessName,
              businessDescription: brand?.business_description,
              productsServices: brand?.products_services,
              imageStyle: brand?.image_style,
              wordsToAvoid: brand?.words_to_avoid,
            })
          );
          background = "ai";
          aiUsed = true;
          // Count it now: the free allowance was spent even if a later step fails.
          await recordCreativeGeneration(service, {
            orgId,
            contentItemId,
            userId: input.userId,
            kind: "ai_photo",
            provider: "cloudflare-flux",
            style,
          });
        } catch (err) {
          if (wanted === "ai") {
            return { error: err instanceof CloudflareImageError ? err.message : "The AI photo could not be made — try again." };
          }
        }
      }
    }
  }

  if (background === "colors" && (wanted === "stock" || wanted === "auto")) {
    try {
      backgroundBytes = await deps.findStockPhoto(captionToImageQuery(item.caption ?? "", item.platform));
      if (backgroundBytes) background = "stock";
      else if (wanted === "stock") return { error: "No matching stock photo was found for this post." };
    } catch {
      if (wanted === "stock") return { error: "Stock photos aren't available right now — try Brand colours instead." };
    }
  }

  const backgroundDataUrl = backgroundBytes ? toDataUrl(backgroundBytes) : null;
  if (backgroundBytes && !backgroundDataUrl) background = "colors"; // an image format the renderer can't draw

  // --- logo (optional; a missing or unreadable file just means no logo) ------
  let logoDataUrl: string | null = null;
  if (brand?.logo_path) {
    try {
      const { data: file } = await supabase.storage.from("brand-assets").download(brand.logo_path);
      if (file) logoDataUrl = toDataUrl(new Uint8Array(await file.arrayBuffer()));
    } catch {
      logoDataUrl = null;
    }
  }

  // --- draw -----------------------------------------------------------------
  let jpeg: Uint8Array;
  try {
    jpeg = await deps.render({
      style,
      width: CREATIVE_SIZES[size].width,
      height: CREATIVE_SIZES[size].height,
      headline,
      subline,
      businessName,
      contact: style === "offer" ? contactLine(brand) : null,
      colors: brand?.colors ?? null,
      logoDataUrl,
      backgroundDataUrl: background === "colors" ? null : backgroundDataUrl,
    });
  } catch (err) {
    console.error("Creative render failed:", err);
    return { error: "The graphic could not be drawn — try again, or pick a different style." };
  }

  // --- save: upload, attach, then retire the picture(s) it replaces ----------
  const { data: existing } = await supabase.from("content_media").select("id, storage_path").eq("content_item_id", contentItemId);
  const replaced = (existing ?? []).filter((m) => isReplaceableMedia(m.storage_path));

  const path = creativeStoragePath(orgId, randomUUID());
  const { error: uploadError } = await supabase.storage.from("content-media").upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return { error: `Could not save the graphic: ${uploadError.message}` };

  const { error: attachError } = await supabase
    .from("content_media")
    .insert({ content_item_id: contentItemId, org_id: orgId, media_type: "image", storage_path: path });
  if (attachError) {
    await supabase.storage.from("content-media").remove([path]);
    return { error: `Could not attach the graphic: ${attachError.message}` };
  }

  if (replaced.length > 0) {
    await supabase.from("content_media").delete().in("id", replaced.map((m) => m.id));
    await supabase.storage.from("content-media").remove(replaced.map((m) => m.storage_path));
  }

  if (!aiUsed) {
    await recordCreativeGeneration(service, {
      orgId,
      contentItemId,
      userId: input.userId,
      kind: "template",
      provider: "satori",
      style,
    });
  }

  return { ok: true, background, style };
}
