"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";
import type { ConversionEventType, ConversionLinkType } from "@/types/database";

function refresh() {
  revalidatePath("/app/conversions");
}

function normalizeDestination(raw: string): string {
  const trimmed = raw.trim();
  if (/^(https?:|tel:|mailto:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function createConversionLinkAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const type = formData.get("type") as ConversionLinkType;
  const label = (formData.get("label") as string)?.trim();
  const destinationRaw = (formData.get("destination") as string)?.trim();
  if (!label) return { error: "Give this link a label, e.g. \"Homepage WhatsApp button\"." };
  if (!destinationRaw) return { error: "Enter where this should send people (a WhatsApp/tel link, or a page URL)." };

  const { data: link, error } = await supabase
    .from("conversion_links")
    .insert({ org_id: member.orgId, type, label, destination: normalizeDestination(destinationRaw), created_by: member.userId })
    .select("id")
    .single();
  if (error || !link) return { error: error?.message ?? "Could not create this link." };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "conversion_link_created",
    target: link.id,
    newState: { type, label },
  });

  refresh();
  return {};
}

export async function deleteConversionLinkAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = formData.get("id") as string;
  const { error } = await supabase.from("conversion_links").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "conversion_link_deleted",
    target: id,
  });

  refresh();
  return {};
}

// Leads/sales/bookings aren't always attributable to a tracked link (a sale
// closed over the phone, say) — linkId is optional. Clicks are never logged
// here; those only ever come from the public /api/track/[linkId] redirect.
export async function logConversionEventAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const eventType = formData.get("eventType") as ConversionEventType;
  if (!["lead", "sale", "booking"].includes(eventType)) return { error: "Invalid conversion type." };
  const linkId = (formData.get("linkId") as string) || null;
  const valueRaw = formData.get("value") as string;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  const { data: event, error } = await supabase
    .from("conversion_events")
    .insert({
      org_id: member.orgId,
      link_id: linkId,
      event_type: eventType,
      value: valueRaw ? Number(valueRaw) : null,
      notes,
    })
    .select("id")
    .single();
  if (error || !event) return { error: error?.message ?? "Could not log this." };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "conversion_logged",
    target: event.id,
    newState: { eventType, value: valueRaw || null },
  });

  refresh();
  return {};
}
