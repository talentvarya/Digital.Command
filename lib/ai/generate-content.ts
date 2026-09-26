import { generateText } from "@/lib/ai/provider";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { AiProvider, BrandProfile, ContentPlatform } from "@/types/database";

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
  // A one-sentence description of a picture that would suit the post — used as the
  // starting point for its image. Null when the model didn't give one.
  imageIdea: string | null;
  usage: AiUsage;
}

function buildSystemPrompt(brandProfile: BrandProfile | null): string {
  const lines = [
    "You are a social media copywriter working for a client's marketing team.",
    "Write one short, ready-to-post caption plus a matching set of hashtags, and an idea for its picture.",
    'Respond with ONLY a single JSON object of the exact shape {"caption": string, "hashtags": string[], "image_idea": string} — no markdown fences, no commentary.',
    "Hashtags should not include the # symbol; the app adds it when displaying.",
    'image_idea: one sentence (at most 30 words, in English even if the caption is not) describing a picture that suits the post — its subject, setting and mood. Describe only what should be visible; no text, logos or brand names in the picture, and no real people or celebrities.',
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

export function parseResponse(text: string): Omit<GeneratedCaption, "usage"> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (typeof parsed.caption === "string") {
      const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h: unknown) => typeof h === "string") : [];
      const idea = typeof parsed.image_idea === "string" ? parsed.image_idea.replace(/\s+/g, " ").trim().slice(0, 400) : "";
      return { caption: parsed.caption, hashtags, imageIdea: idea || null };
    }
  } catch {
    // fall through to plain-text fallback below
  }
  return { caption: text.trim(), hashtags: [], imageIdea: null };
}

// opts?.provider is only ever passed by assistant-tools.ts's regenerate_content
// tool, which pins "anthropic" regardless of AI_PROVIDER — see provider.ts.
export async function generateCaption(
  params: GenerateCaptionParams,
  opts?: { provider?: AiProvider }
): Promise<GeneratedCaption> {
  const result = await generateText(
    { system: buildSystemPrompt(params.brandProfile), user: buildUserPrompt(params), maxTokens: 1024 },
    opts
  );

  return { ...parseResponse(result.text), usage: result.usage };
}

// Real (not decorative) policy check per spec §10's "Quality/Policy check" —
// blocks a caption from auto-publishing under Autopilot if it uses a word
// the client's Brand Brain says to avoid.
export function findAvoidedWords(caption: string, wordsToAvoid: string[]): string[] {
  const lowerCaption = caption.toLowerCase();
  return wordsToAvoid.filter((word) => word.trim() && lowerCaption.includes(word.trim().toLowerCase()));
}
