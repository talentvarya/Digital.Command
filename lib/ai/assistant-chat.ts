import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
import { ASSISTANT_TOOLS, executeAssistantTool, type AssistantContext } from "@/lib/ai/assistant-tools";
import { logAiUsage } from "@/lib/ai/log-usage";

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

// A hand-rolled loop doesn't get the SDK's own runaway protection for free —
// cap round-trips so a confused model can't loop indefinitely on one message.
const MAX_TOOL_ROUNDS = 5;

function buildSystemPrompt(contextSummary: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are Digital Command's in-app AI assistant for one client's marketing account. Today's date is ${today} — compute relative dates ("tomorrow", "next week") yourself and pass explicit YYYY-MM-DD dates to tools.`,
    contextSummary,
    "Rules:",
    "- You can explain reports/SEO trends, edit/regenerate/skip an already-scheduled planner item, and create a new draft item — using only the tools provided.",
    "- You can NEVER approve paid ad spend, change security settings, delete anything, or perform a bulk/multi-item action — there is no tool for any of that, so simply say you can't.",
    "- Every content change you make always needs the client's own approval before it goes out, even if their account is set to Autopilot — say so when it's relevant.",
    "- Be concise and specific. If a tool reports an error, explain it plainly and suggest what to try instead.",
  ].join("\n");
}

export async function runAssistantChat(
  supabase: SupabaseClient,
  ctx: { orgId: string; userId: string },
  history: AssistantChatMessage[],
  message: string,
  contextSummary: string
): Promise<{ reply: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("The assistant is not configured — ANTHROPIC_API_KEY is missing.");
  }

  const messages: Anthropic.MessageParam[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }];
  const toolCtx: AssistantContext = { supabase, orgId: ctx.orgId, userId: ctx.userId };
  let inputTokens = 0;
  let outputTokens = 0;

  const finish = async (reply: string) => {
    await logAiUsage(supabase, { orgId: ctx.orgId, feature: "assistant_chat", usage: { inputTokens, outputTokens } });
    return { reply };
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      response = await getAnthropicClient().messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(contextSummary),
        messages,
        tools: ASSISTANT_TOOLS,
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) throw new AiGenerationError(`Assistant failed: ${error.message}`);
      throw error;
    }

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return finish(textBlock?.text ?? "I don't have a response for that.");
    }

    const toolUseBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUseBlock) return finish("Something went wrong processing that — please try again.");

    messages.push({ role: "assistant", content: response.content });

    const result = await executeAssistantTool(toolUseBlock.name, (toolUseBlock.input as Record<string, unknown>) ?? {}, toolCtx);
    if (result.usage) {
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
    }

    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseBlock.id, content: result.content, is_error: result.isError }],
    });
  }

  return finish("I've made a few changes but want to check in before going further — what would you like next?");
}
