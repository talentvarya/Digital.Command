"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { logAudit } from "@/lib/audit/log";
import { createCreative } from "@/lib/creative/create";
import { CREATIVE_STYLES } from "@/lib/creative/spec";
import type { ActionResult } from "@/app/register/actions";

const BACKGROUNDS = ["auto", "colors", "stock", "ai"] as const;
const SIZES = ["auto", "square", "portrait"] as const;

function pick<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// Makes a graphic (brand colours, stock photo, or free AI photo, with the post's
// words on it) and attaches it to a planner post. The client still approves the
// post as usual, so an AI slip never publishes by itself.
export async function createCreativeAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const automation = await checkAutomationAllowed(supabase, member.orgId);
  if (!automation.allowed) return { error: automation.reason };

  const contentItemId = formData.get("contentItemId");
  if (typeof contentItemId !== "string" || !contentItemId) return { error: "Choose a post first." };

  const result = await createCreative(supabase, createServiceClient(), {
    orgId: member.orgId,
    userId: member.userId,
    contentItemId,
    style: pick(formData.get("style"), ["auto", ...CREATIVE_STYLES] as const, "auto"),
    background: pick(formData.get("background"), BACKGROUNDS, "auto"),
    size: pick(formData.get("size"), SIZES, "auto"),
    // Only forwarded when the form sent them (the batch button doesn't), so a post's
    // saved description and the caption's own words are used unless the client changed them.
    imagePrompt: formData.has("imagePrompt") ? String(formData.get("imagePrompt") ?? "") : undefined,
    headline: formData.has("headline") ? String(formData.get("headline") ?? "") : undefined,
    subline: formData.has("subline") ? String(formData.get("subline") ?? "") : undefined,
  });
  if ("error" in result) return { error: result.error };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "creative_generated",
    target: contentItemId,
    newState: { style: result.style, background: result.background },
  });

  // The batch button refreshes the page once at the end instead of after every image.
  if (formData.get("batch") !== "1") revalidatePath("/app/planner");
  return {};
}
