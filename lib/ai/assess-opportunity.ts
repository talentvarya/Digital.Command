import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
import type { BrandProfile } from "@/types/database";
import type { PageContent } from "@/lib/web/fetch-page";

export interface OpportunityAssessment {
  relevanceScore: number;
  qualityNotes: string;
  spamRisk: "low" | "medium" | "high";
}

const SYSTEM_PROMPT = `You evaluate a web page as a potential off-page SEO opportunity (guest post, broken-link replacement, or unlinked mention) for a client's business.
Judge ONLY from the page content given to you — never invent facts about the site.
Respond with ONLY a JSON object: {"relevanceScore": number (0-100, how relevant this page/site is to the client's business), "qualityNotes": string (one or two honest sentences on content quality/thin content/ads/legitimacy), "spamRisk": "low"|"medium"|"high"}.
Flag spamRisk "high" for thin/auto-generated content, excessive ads, or link-farm signals. Be conservative — when unsure, say so in qualityNotes rather than guessing.`;

export async function assessOpportunity(params: {
  page: PageContent;
  brandProfile: BrandProfile | null;
}): Promise<OpportunityAssessment> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("AI assessment is not configured — ANTHROPIC_API_KEY is missing.");
  }

  const lines = [
    `Page URL: ${params.page.url}`,
    `Page title: ${params.page.title || "(none)"}`,
    `Page text (truncated): ${params.page.textContent.slice(0, 2000) || "(no readable text found)"}`,
  ];
  if (params.brandProfile?.business_description) {
    lines.push(`Client's business: ${params.brandProfile.business_description}`);
  }
  if (params.brandProfile?.products_services) {
    lines.push(`Client's products/services: ${params.brandProfile.products_services}`);
  }

  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: lines.join("\n") }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new AiGenerationError("The AI response did not contain any text.");

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    const spamRisk = ["low", "medium", "high"].includes(parsed.spamRisk) ? parsed.spamRisk : "medium";
    return {
      relevanceScore: Math.max(0, Math.min(100, Math.round(Number(parsed.relevanceScore) || 0))),
      qualityNotes: typeof parsed.qualityNotes === "string" ? parsed.qualityNotes : "No assessment notes returned.",
      spamRisk,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new AiGenerationError(`AI assessment failed: ${error.message}`);
    }
    throw error;
  }
}
