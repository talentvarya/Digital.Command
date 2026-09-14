import { generateText } from "@/lib/ai/provider";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { BrandProfile } from "@/types/database";
import type { PageContent } from "@/lib/web/fetch-page";

export interface OpportunityAssessment {
  relevanceScore: number;
  qualityNotes: string;
  spamRisk: "low" | "medium" | "high";
  usage: AiUsage;
}

const SYSTEM_PROMPT = `You evaluate a web page as a potential off-page SEO opportunity (guest post, broken-link replacement, or unlinked mention) for a client's business.
Judge ONLY from the page content given to you — never invent facts about the site.
Respond with ONLY a JSON object: {"relevanceScore": number (0-100, how relevant this page/site is to the client's business), "qualityNotes": string (one or two honest sentences on content quality/thin content/ads/legitimacy), "spamRisk": "low"|"medium"|"high"}.
Flag spamRisk "high" for thin/auto-generated content, excessive ads, or link-farm signals. Be conservative — when unsure, say so in qualityNotes rather than guessing.`;

export async function assessOpportunity(params: {
  page: PageContent;
  brandProfile: BrandProfile | null;
}): Promise<OpportunityAssessment> {
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

  const result = await generateText({ system: SYSTEM_PROMPT, user: lines.join("\n"), maxTokens: 512 });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
  const spamRisk = ["low", "medium", "high"].includes(parsed.spamRisk) ? parsed.spamRisk : "medium";
  return {
    relevanceScore: Math.max(0, Math.min(100, Math.round(Number(parsed.relevanceScore) || 0))),
    qualityNotes: typeof parsed.qualityNotes === "string" ? parsed.qualityNotes : "No assessment notes returned.",
    spamRisk,
    usage: result.usage,
  };
}
