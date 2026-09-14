import { AiGenerationError } from "@/lib/ai/client";
import type { GenerateTextParams, GenerateTextResult } from "@/lib/ai/provider";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.6-luna";

interface OpenaiResponse {
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

export async function generateWithOpenai(params: GenerateTextParams): Promise<GenerateTextResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError("OpenAI generation is not configured — OPENAI_API_KEY is missing.");
  }

  let res: Response;
  try {
    res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      // Responses API (OpenAI's current recommended default, not the older
      // Chat Completions shape) — input/instructions/max_output_tokens,
      // output_text as a flat convenience field on the raw REST response.
      body: JSON.stringify({
        model: MODEL,
        input: params.user,
        instructions: params.system,
        max_output_tokens: params.maxTokens,
      }),
    });
  } catch {
    throw new AiGenerationError("OpenAI generation failed: could not reach api.openai.com.");
  }

  const data = (await res.json().catch(() => null)) as OpenaiResponse | null;

  if (!res.ok) {
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new AiGenerationError("OpenAI generation failed: invalid OPENAI_API_KEY.");
    if (res.status === 429) throw new AiGenerationError("OpenAI generation is rate-limited right now — please try again shortly.");
    throw new AiGenerationError(`OpenAI generation failed: ${message}`);
  }

  const text = data?.output_text;
  if (!text) throw new AiGenerationError("The OpenAI response did not contain any text.");

  return {
    text,
    usage: {
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0,
    },
  };
}
