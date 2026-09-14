import { AiGenerationError } from "@/lib/ai/client";
import type { GenerateTextParams, GenerateTextResult } from "@/lib/ai/provider";

const MODEL = "gemini-3.5-flash-lite";
const GENERATE_CONTENT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

export async function generateWithGemini(params: GenerateTextParams): Promise<GenerateTextResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiGenerationError("Gemini generation is not configured — GEMINI_API_KEY is missing.");
  }

  let res: Response;
  try {
    res = await fetch(GENERATE_CONTENT_URL, {
      method: "POST",
      headers: {
        // Google migrated to a header-based key format (Sept 2026) — the older
        // ?key= query-param auth still works for legacy keys but is no longer
        // accepted for newly issued ones, so this header is the only reliable path.
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: params.user }] }],
        systemInstruction: { parts: [{ text: params.system }] },
        generationConfig: { maxOutputTokens: params.maxTokens },
      }),
    });
  } catch {
    throw new AiGenerationError("Gemini generation failed: could not reach generativelanguage.googleapis.com.");
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null;

  if (!res.ok) {
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 || res.status === 403) throw new AiGenerationError("Gemini generation failed: invalid GEMINI_API_KEY.");
    if (res.status === 429) throw new AiGenerationError("Gemini generation is rate-limited right now — please try again shortly.");
    throw new AiGenerationError(`Gemini generation failed: ${message}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiGenerationError("The Gemini response did not contain any text.");

  return {
    text,
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
