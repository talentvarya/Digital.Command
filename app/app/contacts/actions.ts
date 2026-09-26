"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { logAudit } from "@/lib/audit/log";
import { normalizePhone } from "@/lib/contacts/phone";
import { cleanName, cleanTags, parseContactLines } from "@/lib/contacts/import";
import { cleanFreeText } from "@/lib/planner/optional-column";
import type { ActionResult } from "@/app/register/actions";

// A customer list per business, for WhatsApp messages the client sends themselves.
// Nothing here sends a message. Only the business's own members can reach these
// rows (row-level security), and every write repeats the org filter as well.

// (Not exported: a "use server" file may only export async functions.)
const MAX_CONTACTS_PER_BUSINESS = 5000;
const NOTES_MAX = 300;
const CONSENT_NOTE_MAX = 120;
const IMPORT_TEXT_MAX = 60_000;

function refresh() {
  revalidatePath("/app/contacts");
}

const flag = (value: FormDataEntryValue | null) => value === "on" || value === "true" || value === "1";
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

// ============================================================================
// Add one customer
// ============================================================================
export async function addContactAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const name = cleanName(text(formData.get("name")));
  if (!name) return { error: "Enter the customer's name." };
  const phone = normalizePhone(text(formData.get("phone")));
  if (!phone.ok) return { error: phone.reason };

  const consent = flag(formData.get("consent"));
  const { count } = await supabase.from("customer_contacts").select("id", { count: "exact", head: true }).eq("org_id", member.orgId);
  if ((count ?? 0) >= MAX_CONTACTS_PER_BUSINESS) return { error: `Your list can hold up to ${MAX_CONTACTS_PER_BUSINESS.toLocaleString("en-IN")} customers.` };

  const { data, error } = await supabase
    .from("customer_contacts")
    .insert({
      org_id: member.orgId,
      name,
      phone: phone.digits,
      tags: cleanTags(text(formData.get("tags"))),
      notes: cleanFreeText(formData.get("notes"), NOTES_MAX),
      consent,
      consent_note: consent ? cleanFreeText(formData.get("consentNote"), CONSENT_NOTE_MAX) : null,
      consent_at: consent ? new Date().toISOString() : null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That number is already in your list." };
    return { error: error.message };
  }

  // The audit trail records that a customer was added, never their details.
  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "contact_added",
    target: data?.id ?? null,
    newState: { consent },
  });

  refresh();
  return { message: `${name} was added.` };
}

// ============================================================================
// Add many at once from a pasted list
// ============================================================================
export async function importContactsAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const list = text(formData.get("list"));
  if (!list.trim()) return { error: "Paste your customers first — one per line, like: Ravi Sharma, 98765 43210" };
  if (list.length > IMPORT_TEXT_MAX) return { error: "That list is too long to import at once — split it into smaller pieces." };

  const parsed = parseContactLines(list);
  if (parsed.contacts.length === 0) {
    const first = parsed.problems[0];
    return { error: first ? `No usable numbers found. Line ${first.line}: ${first.reason}` : "No usable numbers found." };
  }

  const allAgreed = flag(formData.get("consent"));
  const { count } = await supabase.from("customer_contacts").select("id", { count: "exact", head: true }).eq("org_id", member.orgId);
  if ((count ?? 0) + parsed.contacts.length > MAX_CONTACTS_PER_BUSINESS) {
    return { error: `Your list can hold up to ${MAX_CONTACTS_PER_BUSINESS.toLocaleString("en-IN")} customers — this import would go over.` };
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("customer_contacts")
    .upsert(
      parsed.contacts.map((c) => ({
        org_id: member.orgId,
        name: c.name,
        phone: c.phone,
        tags: c.tags,
        consent: allAgreed,
        consent_note: allAgreed ? "Confirmed for this imported list" : null,
        consent_at: allAgreed ? now : null,
        created_by: member.userId,
      })),
      { onConflict: "org_id,phone", ignoreDuplicates: true }
    )
    .select("id");
  if (error) return { error: error.message };

  const added = inserted?.length ?? 0;
  const alreadyThere = parsed.contacts.length - added;

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "contacts_imported",
    newState: { added, alreadyThere, unreadable: parsed.problems.length, consent: allAgreed },
  });

  const parts = [`Added ${added} ${added === 1 ? "customer" : "customers"}.`];
  if (alreadyThere > 0) parts.push(`${alreadyThere} ${alreadyThere === 1 ? "was" : "were"} already in your list.`);
  if (parsed.duplicates > 0) parts.push(`${parsed.duplicates} repeated ${parsed.duplicates === 1 ? "number was" : "numbers were"} skipped.`);
  if (parsed.problems.length > 0) {
    const shown = parsed.problems.slice(0, 3).map((p) => `line ${p.line}`).join(", ");
    parts.push(`${parsed.problems.length} ${parsed.problems.length === 1 ? "line" : "lines"} couldn't be read (${shown}${parsed.problems.length > 3 ? ", …" : ""}).`);
  }
  if (parsed.tooMany) parts.push("Only the first 500 lines were read — paste the rest separately.");
  if (!allAgreed) parts.push("They're saved without consent, so they won't appear in message lists until you tick that they agreed.");

  refresh();
  return { message: parts.join(" ") };
}

// ============================================================================
// Edit one customer: details, consent, and "asked us to stop"
// ============================================================================
export async function updateContactAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = text(formData.get("id"));
  const name = cleanName(text(formData.get("name")));
  if (!id) return { error: "Customer not found." };
  if (!name) return { error: "Enter the customer's name." };

  const consent = flag(formData.get("consent"));
  const optedOut = flag(formData.get("optedOut"));

  const { data: before } = await supabase
    .from("customer_contacts")
    .select("consent, opted_out")
    .eq("id", id)
    .eq("org_id", member.orgId)
    .maybeSingle();
  if (!before) return { error: "Customer not found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customer_contacts")
    .update({
      name,
      tags: cleanTags(text(formData.get("tags"))),
      notes: cleanFreeText(formData.get("notes"), NOTES_MAX),
      consent,
      // stamped when it is first given; cleared when withdrawn
      ...(consent && !before.consent ? { consent_at: now } : {}),
      ...(!consent ? { consent_at: null, consent_note: null } : {}),
      opted_out: optedOut,
      ...(optedOut && !before.opted_out ? { opted_out_at: now } : {}),
      ...(!optedOut ? { opted_out_at: null } : {}),
      updated_at: now,
    })
    .eq("id", id)
    .eq("org_id", member.orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "contact_updated",
    target: id,
    previousState: { consent: before.consent, optedOut: before.opted_out },
    newState: { consent, optedOut },
  });

  refresh();
  return { message: "Saved." };
}

// ============================================================================
// Remove one customer
// ============================================================================
export async function deleteContactAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = text(formData.get("id"));
  if (!id) return { error: "Customer not found." };

  const { error } = await supabase.from("customer_contacts").delete().eq("id", id).eq("org_id", member.orgId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId: member.orgId,
    actorUserId: member.userId,
    actorRole: "client_owner",
    source: "CLIENT_MANUAL",
    actionType: "contact_deleted",
    target: id,
  });

  refresh();
  return {};
}

// ============================================================================
// Note that a message was opened for someone — only for a customer who agreed
// and hasn't asked to stop. Not logged to the audit trail (it would swamp it),
// and the page isn't refreshed: the message list keeps its own "opened" ticks,
// and "last messaged" shows the new time the next time the page loads.
// ============================================================================
export async function markMessagedAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;

  const id = text(formData.get("id"));
  if (!id) return { error: "Customer not found." };

  const { error } = await supabase
    .from("customer_contacts")
    .update({ last_messaged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", member.orgId)
    .eq("consent", true)
    .eq("opted_out", false);
  if (error) return { error: error.message };

  return {};
}
