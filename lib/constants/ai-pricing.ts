// Verified directly against claude.com/pricing (Sept 2026) — re-check
// periodically, Anthropic's published pricing can change.
export const HAIKU_INPUT_COST_PER_MTOK = 1;
export const HAIKU_OUTPUT_COST_PER_MTOK = 5;

export function estimateHaikuCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_MTOK;
}
