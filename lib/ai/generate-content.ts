import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
import type { BrandProfile, ContentPlatform } from "@/types/database";

export { AiGenerationError } from "@/lib/ai/client";

export interface GenerateCaptionParams {
  platform: ContentPlatform;
  brandProfile: BrandProfile | null;
  previousCaptions?: string[];
  clientSuggestion?: string | null;
}

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
}

function buildSystemPrompt(brandProfile: BrandProfile | null): string {
  const lines = [
    "You are a social media copywriter working for a client's marketing team.",
    "Write one short, ready-to-post caption plus a matching set of hashtags.",
    'Respond with ONLY a single JSON object of the exact shape {"caption": string, "hashtags": string[]} — no markdown fences, no commentary.',
    "Hashtags should not include the # symbol; the app adds it when displaying.",
  ];

  if (brandProfile) {
    if (brandProfile.business_description) lines.push(`Business: ${brandProfile.business_description}`);
    if (brandProfile.products_services) lines.push(`Products/services: ${brandProfile.products_services}`);
    if (brandProfile.target_audience) lines.push(`Target audience: ${brandProfile.target_audience}`);
    if (brandProfile.preferred_tone) lines.push(`Preferred tone: ${brandProfile.preferred_tone}`);
    if (brandProfile.cta_style) lines.push(`Call-to-action style: ${brandProfile.cta_style}`);
    if (brandProfile.offers) lines.push(`Current offers to mention if relevant: ${brandProfile.offers}`);
    if (brandProfile.locations) lines.push(`Location(s): ${brandProfile.locations}`);
    if (brandProfile.words_to_avoid?.length) {
      lines.push(`Never use these words/phrases: ${brandProfile.words_to_avoid.join(", ")}`);
    }
  } else {
    lines.push("No Brand Brain profile has been set up yet — write a generic, safe, professional caption.");
  }

  lines.push(
    "Never claim guaranteed results, guaranteed rankings, or guaranteed revenue/leads. Keep claims honest and specific."
  );

  return lines.join("\n");
}

function buildUserPrompt(params: GenerateCaptionParams): string {
  const lines = [`Write a caption for a ${params.platform} post.`];

  if (params.previousCaptions?.length) {
    lines.push(
      "These captions were already generated and rejected for this same post — write something meaningfully different:",
      ...params.previousCaptions.map((c, i) => `${i + 1}. ${c}`)
    );
  }

  if (params.clientSuggestion) {
    lines.push(`The client gave this specific direction — follow it closely: "${params.clientSuggestion}"`);
  }

  return lines.join("\n");
}

function parseResponse(text: string): GeneratedCaption {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (typeof parsed.caption === "string") {
      const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h: unknown) => typeof h === "string") : [];
      return { caption: parsed.caption, hashtags };
    }
  } catch {
    // fall through to plain-text fallback below
  }
  return { caption: text.trim(), hashtags: [] };
}

export async function generateCaption(params: GenerateCaptionParams): Promise<GeneratedCaption> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("AI generation is not configured — ANTHROPIC_API_KEY is missing.");
  }

  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(params.brandProfile),
      messages: [{ role: "user", content: buildUserPrompt(params) }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) {
      throw new AiGenerationError("The AI response did not contain any text.");
    }

    return parseResponse(textBlock.text);
  } catch (error) {
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

// Real (not decorative) policy check per spec §10's "Quality/Policy check" —
// blocks a caption from auto-publishing under Autopilot if it uses a word
// the client's Brand Brain says to avoid.
export function findAvoidedWords(caption: string, wordsToAvoid: string[]): string[] {
  const lowerCaption = caption.toLowerCase();
  return wordsToAvoid.filter((word) => word.trim() && lowerCaption.includes(word.trim().toLowerCase()));
}
