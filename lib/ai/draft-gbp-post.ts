import { generateText } from "@/lib/ai/provider";
import { parseAiJsonObject } from "@/lib/ai/parse-json";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { BrandProfile, LocalSeoProfile } from "@/types/database";

export interface DraftedGbpPost {
  postText: string;
  keywordSuggestions: string[];
  usage: AiUsage;
}

const SYSTEM_PROMPT = `You write a short "Google Post" (the update posts that show up on a Google Business Profile listing) for a local business, plus a handful of local search keyword ideas.
Rules:
- Post text: 150-300 words, plain and specific (an offer, a product/service highlight, or a seasonal update) — never generic filler.
- Never guarantee rankings, visibility, or any specific result — no "will get you to #1" language.
- Keyword suggestions: 5 short phrases a nearby customer would actually type, combining the business's city/area with what they offer (e.g. "chocolate gifts in Pune").
Respond with ONLY a JSON object: {"postText": string, "keywordSuggestions": string[]}`;

export async function draftGbpPost(params: {
  brandProfile: BrandProfile | null;
  localSeoProfile: LocalSeoProfile | null;
  businessName: string;
}): Promise<DraftedGbpPost> {
  const { brandProfile, localSeoProfile, businessName } = params;
  const lines = [`Business name: ${businessName}`];
  if (brandProfile?.business_description) lines.push(`Business: ${brandProfile.business_description}`);
  if (brandProfile?.products_services) lines.push(`Products/services: ${brandProfile.products_services}`);
  if (brandProfile?.offers) lines.push(`Current offers: ${brandProfile.offers}`);
  if (brandProfile?.preferred_tone) lines.push(`Preferred tone: ${brandProfile.preferred_tone}`);
  const cityParts = [localSeoProfile?.city, localSeoProfile?.state].filter(Boolean);
  if (cityParts.length) lines.push(`Location: ${cityParts.join(", ")}`);
  if (localSeoProfile?.gbp_category) lines.push(`GBP category: ${localSeoProfile.gbp_category}`);

  const result = await generateText({ system: SYSTEM_PROMPT, user: lines.join("\n"), maxTokens: 768 });

  const parsed = parseAiJsonObject(result.text, "Couldn't generate a clean post that time — please try again.");
  return {
    postText: typeof parsed.postText === "string" ? parsed.postText : result.text.trim(),
    keywordSuggestions: Array.isArray(parsed.keywordSuggestions) ? parsed.keywordSuggestions.filter((k: unknown) => typeof k === "string") : [],
    usage: result.usage,
  };
}
