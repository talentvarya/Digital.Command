import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiGenerationError } from "@/lib/ai/client";
import { generateCaption, findAvoidedWords } from "@/lib/ai/generate-content";
import type { AiUsage } from "@/lib/ai/log-usage";
import { logAudit } from "@/lib/audit/log";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { REJECTIONS_BEFORE_SUGGESTION, MONTHLY_AI_GENERATION_SAFETY_CAP } from "@/lib/constants/content";
import type { BrandProfile, ContentPlatform } from "@/types/database";

export interface AssistantContext {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
  usage?: AiUsage;
}

// Deliberately small and explicit — one tool per §17 example prompt, nothing
// bulk, nothing that touches paid_campaigns or security settings. This is
// the actual enforcement of §17's "must NOT" list: there is no tool that
// COULD approve spend or bypass admin controls, not a rule the model has to
// remember to follow.
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "explain_report",
    description: "Read the client's most recently generated report (real metrics + AI summary) and explain it in plain language.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "explain_seo_trend",
    description: "Read the two most recent SEO audits and Search Console snapshots to explain a ranking/traffic change.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "edit_content_caption",
    description:
      "Change the caption/hashtags of an already-scheduled planner item for a specific date. Also use this to improve a YouTube item's title — this app uses the caption field as the YouTube video title.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "The item's scheduled date, YYYY-MM-DD." },
        platform: { type: "string", enum: ["facebook", "instagram", "youtube"], description: "Only needed if more than one item is scheduled that day." },
        newCaption: { type: "string" },
        newHashtags: { type: "array", items: { type: "string" }, description: "Without # symbols." },
      },
      required: ["date", "newCaption"],
    },
  },
  {
    name: "regenerate_content",
    description: "Generate a new AI caption/hashtags for an already-scheduled planner item, replacing the current draft.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "The item's scheduled date, YYYY-MM-DD." },
        platform: { type: "string", enum: ["facebook", "instagram", "youtube"], description: "Only needed if more than one item is scheduled that day." },
        clientSuggestion: { type: "string", description: "What the client wants different this time, if they said anything specific." },
      },
      required: ["date"],
    },
  },
  {
    name: "skip_content_item",
    description: "Skip an already-scheduled planner item for a specific date — nothing gets posted for that slot.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD." },
        platform: { type: "string", enum: ["facebook", "instagram", "youtube"] },
      },
      required: ["date"],
    },
  },
  {
    name: "create_draft_content",
    description: "Create a brand-new planner item (a caption you write) for a date that doesn't have one yet. Always needs the client's approval before it can go out.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD." },
        platform: { type: "string", enum: ["facebook", "instagram", "youtube"] },
        caption: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
      },
      required: ["date", "platform", "caption"],
    },
  },
];

type FoundContentItem = { error: string } | { item: any };

async function findContentItem(supabase: SupabaseClient, orgId: string, date: string, platform?: string): Promise<FoundContentItem> {
  let query = supabase.from("content_items").select("*").eq("org_id", orgId).eq("scheduled_date", date);
  if (platform) query = query.eq("platform", platform);
  const { data } = await query;
  if (!data || data.length === 0) return { error: `No content is scheduled for ${date}${platform ? ` on ${platform}` : ""}.` };
  if (data.length > 1) {
    return { error: `More than one item is scheduled for ${date} (${data.map((i) => i.platform).join(", ")}) — ask which platform.` };
  }
  return { item: data[0] };
}

export async function executeAssistantTool(name: string, input: Record<string, unknown>, ctx: AssistantContext): Promise<ToolResult> {
  const { supabase, orgId, userId } = ctx;

  if (name === "explain_report") {
    const { data: report } = await supabase
      .from("reports")
      .select("period_start, period_end, summary_text, next_plan_text")
      .eq("org_id", orgId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!report) return { content: "No report has been generated yet — there's nothing to explain." };
    return { content: `Report for ${report.period_start} to ${report.period_end}:\nSummary: ${report.summary_text}\nNext plan: ${report.next_plan_text}` };
  }

  if (name === "explain_seo_trend") {
    const [{ data: audits }, { data: snapshots }] = await Promise.all([
      supabase.from("seo_audits").select("score, crawled_at").eq("org_id", orgId).order("crawled_at", { ascending: false }).limit(2),
      supabase
        .from("search_console_snapshots")
        .select("total_clicks, avg_position, date_range_start, date_range_end")
        .eq("org_id", orgId)
        .order("synced_at", { ascending: false })
        .limit(2),
    ]);
    if (!audits?.length && !snapshots?.length) return { content: "No SEO audit or Search Console data exists yet to explain a trend from." };
    const lines: string[] = [];
    if (audits?.length) lines.push(`SEO score: ${audits[0].score}/100${audits[1] ? ` (was ${audits[1].score}/100)` : ""}.`);
    if (snapshots?.length) {
      lines.push(
        `Search Console: ${snapshots[0].total_clicks} clicks, average position ${snapshots[0].avg_position}${
          snapshots[1] ? ` (was ${snapshots[1].total_clicks} clicks, position ${snapshots[1].avg_position})` : ""
        }.`
      );
    }
    return { content: lines.join(" ") };
  }

  if (name === "edit_content_caption") {
    const automation = await checkAutomationAllowed(supabase, orgId);
    if (!automation.allowed) return { content: automation.reason, isError: true };

    const found = await findContentItem(supabase, orgId, input.date as string, input.platform as string | undefined);
    if ("error" in found) return { content: found.error, isError: true };
    if (found.item.locked) return { content: "That item is locked and can't be edited.", isError: true };

    const newCaption = input.newCaption as string;
    const newHashtags = Array.isArray(input.newHashtags) ? (input.newHashtags as string[]) : found.item.hashtags;

    await supabase
      .from("content_items")
      .update({ caption: newCaption, hashtags: newHashtags, status: "waiting_approval", updated_at: new Date().toISOString() })
      .eq("id", found.item.id);

    const { data: versionRows } = await supabase
      .from("content_versions")
      .select("version_number")
      .eq("content_item_id", found.item.id)
      .order("version_number", { ascending: false })
      .limit(1);
    await supabase.from("content_versions").insert({
      content_item_id: found.item.id,
      org_id: orgId,
      version_number: (versionRows?.[0]?.version_number ?? 0) + 1,
      caption: newCaption,
      hashtags: newHashtags,
      generated_by: "gpt_assistant",
    });

    await logAudit(supabase, {
      orgId,
      actorUserId: userId,
      actorRole: "client_owner",
      source: "GPT_ASSISTANT",
      actionType: "content_edited_by_assistant",
      target: found.item.id,
      newState: { caption: newCaption },
    });

    return { content: `Updated the ${found.item.platform} item for ${input.date}. It's now waiting for your approval before it can go out.` };
  }

  if (name === "regenerate_content") {
    const automation = await checkAutomationAllowed(supabase, orgId);
    if (!automation.allowed) return { content: automation.reason, isError: true };

    const found = await findContentItem(supabase, orgId, input.date as string, input.platform as string | undefined);
    if ("error" in found) return { content: found.error, isError: true };
    if (found.item.locked) return { content: "That item is locked and can't be regenerated.", isError: true };

    const clientSuggestion = ((input.clientSuggestion as string) || "").trim() || null;
    if (found.item.rejection_count >= REJECTIONS_BEFORE_SUGGESTION && !clientSuggestion) {
      return { content: "Three AI options have already been tried for this slot — tell me specifically what you'd like different and I'll try again.", isError: true };
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("content_versions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("generated_by", ["ai", "client_suggestion", "gpt_assistant"])
      .gte("created_at", startOfMonth.toISOString());
    if ((count ?? 0) >= MONTHLY_AI_GENERATION_SAFETY_CAP) {
      return { content: `Monthly AI generation limit reached (${MONTHLY_AI_GENERATION_SAFETY_CAP}).`, isError: true };
    }

    const { data: brand } = await supabase.from("brand_profiles").select("*").eq("org_id", orgId).maybeSingle();
    const { data: versions } = await supabase
      .from("content_versions")
      .select("caption")
      .eq("content_item_id", found.item.id)
      .order("version_number", { ascending: false })
      .limit(3);

    let generated;
    try {
      generated = await generateCaption({
        platform: found.item.platform as ContentPlatform,
        brandProfile: (brand as BrandProfile | null) ?? null,
        previousCaptions: (versions ?? []).map((v) => v.caption).filter(Boolean) as string[],
        clientSuggestion,
      });
    } catch (err) {
      return { content: err instanceof AiGenerationError ? err.message : "Regeneration failed.", isError: true };
    }

    const avoidedWords = findAvoidedWords(generated.caption, brand?.words_to_avoid ?? []);

    await supabase
      .from("content_items")
      .update({
        caption: generated.caption,
        hashtags: generated.hashtags,
        status: "waiting_approval",
        rejection_count: found.item.rejection_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", found.item.id);

    const { data: versionRows } = await supabase
      .from("content_versions")
      .select("version_number")
      .eq("content_item_id", found.item.id)
      .order("version_number", { ascending: false })
      .limit(1);
    await supabase.from("content_versions").insert({
      content_item_id: found.item.id,
      org_id: orgId,
      version_number: (versionRows?.[0]?.version_number ?? 0) + 1,
      caption: generated.caption,
      hashtags: generated.hashtags,
      generated_by: "gpt_assistant",
      client_suggestion_text: clientSuggestion,
    });

    await logAudit(supabase, {
      orgId,
      actorUserId: userId,
      actorRole: "client_owner",
      source: "GPT_ASSISTANT",
      actionType: "content_regenerated_by_assistant",
      target: found.item.id,
    });

    return {
      content: `New draft for the ${found.item.platform} item on ${input.date}: "${generated.caption}"${
        avoidedWords.length ? ` (note: contains a word your Brand Brain says to avoid — ${avoidedWords.join(", ")})` : ""
      } — waiting for your approval.`,
      usage: generated.usage,
    };
  }

  if (name === "skip_content_item") {
    const found = await findContentItem(supabase, orgId, input.date as string, input.platform as string | undefined);
    if ("error" in found) return { content: found.error, isError: true };
    if (found.item.locked) return { content: "That item is locked and can't be skipped.", isError: true };

    await supabase.from("content_items").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", found.item.id);

    await logAudit(supabase, {
      orgId,
      actorUserId: userId,
      actorRole: "client_owner",
      source: "GPT_ASSISTANT",
      actionType: "content_skipped_by_assistant",
      target: found.item.id,
    });

    return { content: `Skipped the ${found.item.platform} item for ${input.date}. Nothing will be posted for that slot.` };
  }

  if (name === "create_draft_content") {
    const automation = await checkAutomationAllowed(supabase, orgId);
    if (!automation.allowed) return { content: automation.reason, isError: true };

    const { data: settings } = await supabase.from("client_settings").select("content_control_mode").eq("org_id", orgId).maybeSingle();

    const { data: item, error } = await supabase
      .from("content_items")
      .insert({
        org_id: orgId,
        platform: input.platform as ContentPlatform,
        scheduled_date: input.date as string,
        caption: input.caption as string,
        hashtags: Array.isArray(input.hashtags) ? (input.hashtags as string[]) : [],
        status: "waiting_approval",
        source: "gpt_assistant_generated",
        control_mode: settings?.content_control_mode ?? "approval_required",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !item) return { content: error?.message ?? "Could not create the draft.", isError: true };

    await supabase.from("content_versions").insert({
      content_item_id: item.id,
      org_id: orgId,
      version_number: 1,
      caption: input.caption as string,
      hashtags: Array.isArray(input.hashtags) ? (input.hashtags as string[]) : [],
      generated_by: "gpt_assistant",
    });

    await logAudit(supabase, {
      orgId,
      actorUserId: userId,
      actorRole: "client_owner",
      source: "GPT_ASSISTANT",
      actionType: "content_created_by_assistant",
      target: item.id,
    });

    return { content: `Created a draft ${input.platform} post for ${input.date}. It's waiting for your approval.` };
  }

  return { content: `Unknown tool: ${name}`, isError: true };
}
