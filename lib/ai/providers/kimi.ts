import { AiGenerationError } from "@/lib/ai/client";
import type { GenerateTextParams, GenerateTextResult } from "@/lib/ai/provider";

// Kimi (Moonshot AI) — genuinely OpenAI-compatible, verified directly against
// platform.kimi.ai/docs/api/chat (platform.moonshot.ai 301-redirects there,
// confirming it's the current canonical docs domain), not guessed. Plain
// fetch(), not the `openai` package — matches every other third-party API in
// this codebase (Buffer, Google, YouTube all chose fetch() over an available
// SDK) for what's a single endpoint, no streaming, no tool-calling.
const CHAT_COMPLETIONS_URL = "https://api.moonshot.ai/v1/chat/completions";

// kimi-k2.6 is Kimi's small/cheap tier (vs. the kimi-k3 flagship, or the
// kimi-k2.7-code variants which are code-specialized) — the same role Haiku
// plays for Claude in this app, for the identical reason: short, high-volume,
// cost-sensitive generation (captions, report narratives, assessments).
const KIMI_MODEL = "kimi-k2.6";

interface KimiResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export async function generateWithKimi(params: GenerateTextParams): Promise<GenerateTextResult> {
  if (!process.env.MOONSHOT_API_KEY) {
    throw new AiGenerationError("Kimi generation is not configured — MOONSHOT_API_KEY is missing.");
  }

  let res: Response;
  try {
    res = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        max_completion_tokens: params.maxTokens,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });
  } catch {
    throw new AiGenerationError("Kimi generation failed: could not reach api.moonshot.ai.");
  }

  const data = (await res.json().catch(() => null)) as KimiResponse | null;

  if (!res.ok) {
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new AiGenerationError("Kimi generation failed: invalid MOONSHOT_API_KEY.");
    if (res.status === 429) throw new AiGenerationError("Kimi generation is rate-limited right now — please try again shortly.");
    throw new AiGenerationError(`Kimi generation failed: ${message}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AiGenerationError("The Kimi response did not contain any text.");

  return {
    text,
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
    },
  };
}
