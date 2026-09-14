import type { AiProvider } from "@/types/database";

// Verified directly against claude.com/pricing (Sept 2026) — re-check
// periodically, Anthropic's published pricing can change.
export const HAIKU_INPUT_COST_PER_MTOK = 1;
export const HAIKU_OUTPUT_COST_PER_MTOK = 5;

export function estimateHaikuCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_MTOK;
}

// Verified directly against platform.kimi.ai's pricing page (Sept 2026) —
// re-check periodically, same discipline as the Haiku constants above.
// kimi-k2.6's cache-miss rate (the realistic one — these are one-shot
// prompts, nothing here uses prompt caching).
export const KIMI_INPUT_COST_PER_MTOK = 0.95;
export const KIMI_OUTPUT_COST_PER_MTOK = 4.0;

export function estimateKimiCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * KIMI_INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * KIMI_OUTPUT_COST_PER_MTOK;
}

// Verified directly against ai.google.dev/gemini-api/docs/pricing (Sept 2026)
// — re-check periodically. gemini-3.5-flash-lite: the small/cheap tier of the
// current top-generation family (same "current-gen small tier" reasoning as
// Haiku/kimi-k2.6 above), not the older-but-cheaper gemini-2.5-flash-lite.
export const GEMINI_INPUT_COST_PER_MTOK = 0.3;
export const GEMINI_OUTPUT_COST_PER_MTOK = 2.5;

export function estimateGeminiCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * GEMINI_INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * GEMINI_OUTPUT_COST_PER_MTOK;
}

// Verified directly against developers.openai.com/api/docs/pricing (Sept 2026)
// — re-check periodically. gpt-5.6-luna: the small/cheap tier of the current
// "5.6" family — gpt-6-astra (the newest flagship, released Sept 3 2026) has
// no smaller sibling yet, so 5.6-luna is the current-gen small tier, same
// reasoning as the other three providers' picks above.
export const OPENAI_INPUT_COST_PER_MTOK = 0.2;
export const OPENAI_OUTPUT_COST_PER_MTOK = 1.2;

export function estimateOpenaiCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * OPENAI_INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * OPENAI_OUTPUT_COST_PER_MTOK;
}

const ESTIMATORS: Record<AiProvider, (inputTokens: number, outputTokens: number) => number> = {
  anthropic: estimateHaikuCostUsd,
  kimi: estimateKimiCostUsd,
  gemini: estimateGeminiCostUsd,
  openai: estimateOpenaiCostUsd,
};

export function estimateAiCostUsd(provider: AiProvider, inputTokens: number, outputTokens: number): number {
  return ESTIMATORS[provider](inputTokens, outputTokens);
}
