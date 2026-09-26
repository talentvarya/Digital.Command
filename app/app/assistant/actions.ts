"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { isEmergencyFrozen } from "@/lib/automation/guard";
import { runAssistantChat, type AssistantChatMessage } from "@/lib/ai/assistant-chat";
import { AiGenerationError } from "@/lib/ai/client";
import { istDateString } from "@/lib/utils/ist";

// Not the usual (prevState, FormData) => ActionResult shape every other
// action in this app uses — a chat transcript is a growing list, not a
// single form result, so the client calls this directly (see
// components/assistant/AssistantChat.tsx). Conversation history itself is
// never persisted server-side (kept in the browser's own React state) —
// only the individual tool actions the assistant takes get written to
// content_items/content_versions/audit_logs, which is what actually needs
// to survive a refresh.
export async function sendAssistantMessageAction(
  history: AssistantChatMessage[],
  message: string
): Promise<{ reply: string } | { error: string }> {
  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return member;
  const { orgId, userId } = member;

  if (await isEmergencyFrozen(supabase)) {
    return { error: "AI jobs are paused platform-wide (Emergency Freeze) — try again once it's lifted." };
  }

  const [{ data: brand }, { data: settings }, { data: upcoming }] = await Promise.all([
    supabase.from("brand_profiles").select("business_description, preferred_tone").eq("org_id", orgId).maybeSingle(),
    supabase.from("client_settings").select("content_control_mode").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("content_items")
      .select("scheduled_date, platform, status, caption")
      .eq("org_id", orgId)
      .gte("scheduled_date", istDateString())
      .order("scheduled_date", { ascending: true })
      .limit(10),
  ]);

  const contextLines = [
    `Content control mode: ${settings?.content_control_mode ?? "approval_required"}.`,
    brand?.business_description ? `Business: ${brand.business_description}` : "No Brand Brain set up yet.",
    brand?.preferred_tone ? `Preferred tone: ${brand.preferred_tone}` : "",
    "Upcoming planner items:",
    ...(upcoming ?? []).map((i) => `- ${i.scheduled_date} ${i.platform} (${i.status}): ${(i.caption ?? "(no caption)").slice(0, 80)}`),
  ].filter(Boolean);
  if (!upcoming?.length) contextLines.push("(nothing scheduled in the next 10 items)");

  try {
    const result = await runAssistantChat(supabase, { orgId, userId }, history, message, contextLines.join("\n"));
    revalidatePath("/app/planner");
    revalidatePath("/app/dashboard");
    return result;
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }
}
