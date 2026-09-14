import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
import type { AdPlatform, BrandProfile } from "@/types/database";

export interface CampaignDraft {
  audienceDescription: string;
  keywords: string[];
  creativeBrief: string;
  suggestedBudgetNotes: string;
}

// Deliberately never returns a single "suggested budget" number presented as
// authoritative — spec §14/§36 treat paid spend as the one place this app
// must not create false confidence. The client sets the real, binding
// max_spend themselves at approval time (see app/app/paid-campaigns/actions.ts).
const SYSTEM_PROMPT = `You help prepare a DRAFT paid ad campaign brief for a client to review — you are not setting a budget or launching anything.
Respond with ONLY a JSON object: {"audienceDescription": string, "keywords": string[] (5-15 short keyword phrases, relevant mainly for search-style platforms — return [] if not applicable to the platform), "creativeBrief": string (ad copy direction/angle, 2-4 sentences), "suggestedBudgetNotes": string}
Rules:
- suggestedBudgetNotes must be QUALITATIVE guidance only (e.g. what factors affect budget, a realistic starting range framed as "many businesses in this category start around X-Y, but this varies") — never a single number stated as a recommendation, never a guarantee of results.
- Never promise guaranteed clicks, leads, sales, or rankings.
- Base everything on the business context given — don't invent details about the client.`;

export async function prepareCampaignDraft(params: {
  platform: AdPlatform;
  objective: string;
  goalDescription: string;
  brandProfile: BrandProfile | null;
}): Promise<CampaignDraft> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("AI generation is not configured — ANTHROPIC_API_KEY is missing.");
  }

  const lines = [
    `Platform: ${params.platform.replace(/_/g, " ")}`,
    `Objective: ${params.objective}`,
    `What the client wants to achieve: ${params.goalDescription}`,
  ];
  if (params.brandProfile?.business_description) lines.push(`Business: ${params.brandProfile.business_description}`);
  if (params.brandProfile?.products_services) lines.push(`Products/services: ${params.brandProfile.products_services}`);
  if (params.brandProfile?.target_audience) lines.push(`Known target audience: ${params.brandProfile.target_audience}`);
  if (params.brandProfile?.locations) lines.push(`Location(s): ${params.brandProfile.locations}`);
  if (params.brandProfile?.preferred_tone) lines.push(`Preferred tone: ${params.brandProfile.preferred_tone}`);

  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 768,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: lines.join("\n") }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new AiGenerationError("The AI response did not contain any text.");

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    return {
      audienceDescription: typeof parsed.audienceDescription === "string" ? parsed.audienceDescription : "",
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === "string") : [],
      creativeBrief: typeof parsed.creativeBrief === "string" ? parsed.creativeBrief : "",
      suggestedBudgetNotes: typeof parsed.suggestedBudgetNotes === "string" ? parsed.suggestedBudgetNotes : "",
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new AiGenerationError(`AI generation failed: ${error.message}`);
    }
    throw error;
  }
}
