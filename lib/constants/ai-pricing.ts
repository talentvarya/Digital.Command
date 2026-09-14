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

export function estimateAiCostUsd(provider: AiProvider, inputTokens: number, outputTokens: number): number {
  return provider === "kimi" ? estimateKimiCostUsd(inputTokens, outputTokens) : estimateHaikuCostUsd(inputTokens, outputTokens);
}
