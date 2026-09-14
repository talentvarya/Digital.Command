import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// Short, high-volume marketing text (captions, report narratives) doesn't
// need a frontier model — Haiku keeps this fast and cheap, matching the
// spec's emphasis on per-client AI cost control (§30/§32).
export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export class AiGenerationError extends Error {}

// Anthropic.APIError.message carries the whole raw JSON envelope
// (`400 {"type":"error","error":{...,"message":"..."}}`), which is unreadable
// if it ever reaches a client's screen. Pull out just the human sentence.
export function readableApiErrorMessage(error: Anthropic.APIError): string {
  const raw = error.message ?? "";
  const match = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return raw;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}
