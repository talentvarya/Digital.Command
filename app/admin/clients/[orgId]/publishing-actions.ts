"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";
import type { BufferPlatform } from "@/types/database";

export async function linkBufferChannelAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const orgId = formData.get("orgId") as string;
  const platform = formData.get("platform") as BufferPlatform;
  const bufferChannelId = formData.get("bufferChannelId") as string;
  const bufferChannelName = (formData.get("bufferChannelName") as string) || null;
  if (!bufferChannelId) return { error: "Choose a Buffer channel." };

  const { error } = await supabase.from("buffer_channel_links").upsert(
    {
      org_id: orgId,
      platform,
      buffer_channel_id: bufferChannelId,
      buffer_channel_name: bufferChannelName,
      linked_by: admin.id,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "org_id,platform" }
  );
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "buffer_channel_linked",
    target: orgId,
    newState: { platform, bufferChannelId, bufferChannelName },
  });

  revalidatePath(`/admin/clients/${orgId}`);
  return {};
}

export async function unlinkBufferChannelAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if ("error" in admin) return admin;

  const id = formData.get("id") as string;
  const orgId = formData.get("orgId") as string;

  const { error } = await supabase.from("buffer_channel_links").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    orgId,
    actorUserId: admin.id,
    actorRole: "super_admin",
    source: "ADMIN",
    actionType: "buffer_channel_unlinked",
    target: orgId,
  });

  revalidatePath(`/admin/clients/${orgId}`);
  return {};
}
