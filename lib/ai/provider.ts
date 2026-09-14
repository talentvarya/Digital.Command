import { generateWithAnthropic } from "@/lib/ai/providers/anthropic";
import { generateWithGemini } from "@/lib/ai/providers/gemini";
import { generateWithOpenai } from "@/lib/ai/providers/openai";
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

const KNOWN_PROVIDERS: AiProvider[] = ["anthropic", "gemini", "openai"];

function resolveProvider(requested?: AiProvider): AiProvider {
  if (requested && KNOWN_PROVIDERS.includes(requested)) return requested;
  const envProvider = process.env.AI_PROVIDER as AiProvider | undefined;
  return envProvider && KNOWN_PROVIDERS.includes(envProvider) ? envProvider : "anthropic";
}

const GENERATORS: Record<AiProvider, (params: GenerateTextParams) => Promise<GenerateTextResult>> = {
  anthropic: generateWithAnthropic,
  gemini: generateWithGemini,
  openai: generateWithOpenai,
};

// The one place every generation call goes through instead of touching any
// provider's SDK/fetch client directly — reads AI_PROVIDER (default
// "anthropic", zero config required) unless a caller explicitly pins a
// provider via opts (see assistant-tools.ts's regenerate_content, which
// always pins "anthropic" regardless of AI_PROVIDER — the AI Assistant's
// tool-calling shape isn't portable to any of the other two, see
// ARCHITECTURE.md). This is the one place that stamps `provider` onto the
// returned usage, so every caller's existing `usage: result.usage` passthrough
// to logAiUsage() already carries it correctly.
export async function generateText(
  params: GenerateTextParams,
  opts?: { provider?: AiProvider }
): Promise<GenerateTextResult & { usage: AiUsage }> {
  const provider = resolveProvider(opts?.provider);
  const result = await GENERATORS[provider](params);

  return {
    text: result.text,
    usage: { ...result.usage, provider },
  };
}
