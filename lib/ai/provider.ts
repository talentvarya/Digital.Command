import { generateWithAnthropic } from "@/lib/ai/providers/anthropic";
import { generateWithKimi } from "@/lib/ai/providers/kimi";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { AiProvider } from "@/types/database";

export interface GenerateTextParams {
  system: string;
  user: string;
  maxTokens: number;
}

export interface GenerateTextResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

function resolveProvider(requested?: AiProvider): AiProvider {
  if (requested === "kimi" || requested === "anthropic") return requested;
  return process.env.AI_PROVIDER === "kimi" ? "kimi" : "anthropic";
}

// The one place every generation call goes through instead of touching the
// Anthropic SDK (or Kimi's fetch client) directly — reads AI_PROVIDER
// (default "anthropic", zero config required) unless a caller explicitly
// pins a provider via opts (see assistant-tools.ts's regenerate_content,
// which always pins "anthropic" regardless of AI_PROVIDER — the AI
// Assistant's tool-calling shape isn't portable to Kimi, see
// ARCHITECTURE.md). This is the one place that stamps `provider` onto the
// returned usage, so every caller's existing `usage: result.usage` passthrough
// to logAiUsage() already carries it correctly.
export async function generateText(
  params: GenerateTextParams,
  opts?: { provider?: AiProvider }
): Promise<GenerateTextResult & { usage: AiUsage }> {
  const provider = resolveProvider(opts?.provider);
  const result = provider === "kimi" ? await generateWithKimi(params) : await generateWithAnthropic(params);

  return {
    text: result.text,
    usage: { ...result.usage, provider },
  };
}
