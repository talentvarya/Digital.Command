import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
import type { GenerateTextParams, GenerateTextResult } from "@/lib/ai/provider";

export async function generateWithAnthropic(params: GenerateTextParams): Promise<GenerateTextResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("AI generation is not configured — ANTHROPIC_API_KEY is missing.");
  }

  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new AiGenerationError("The AI response did not contain any text.");

    return {
      text: textBlock.text,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiGenerationError("AI generation failed: invalid ANTHROPIC_API_KEY.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiGenerationError("AI generation is rate-limited right now — please try again shortly.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiGenerationError(`AI generation failed: ${error.message}`);
    }
    throw error;
  }
}
