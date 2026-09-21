import { AiGenerationError } from "@/lib/ai/client";

// The one place AI output gets turned into a JSON object. Every AI-draft
// generator used to carry its own copy of this (match the first {...} block,
// JSON.parse it) and three of them had no failure handling at all, so a
// truncated or badly-escaped model response crashed the whole page — the same
// bug had to be fixed three separate times. A bad response now always surfaces
// as an AiGenerationError, which every caller already turns into a retry-able
// form error.
export function parseAiJsonObject(text: string, failureMessage: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const parsed: unknown = JSON.parse(match ? match[0] : text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AiGenerationError(failureMessage);
  }
}
