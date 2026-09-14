import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
import type { BrandProfile, OffPageOpportunity } from "@/types/database";
import type { PageContent } from "@/lib/web/fetch-page";

export interface DraftedOutreach {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You write short, genuinely personalized off-page SEO outreach emails (guest post pitches, broken-link fix suggestions, or asking a site to add a link for an existing unlinked mention) on behalf of a client's business.
Rules:
- Reference something specific and real from the target page's actual content — never invent details about the recipient's site.
- Keep it short (under 150 words), specific, and non-pushy. No hype, no guaranteed-results language.
- This is a ONE-TO-ONE personal email, not a mass template — write it that way.
- Never mention automation, AI, or that this was generated.
Respond with ONLY a JSON object: {"subject": string, "body": string}`;

export async function draftOutreachMessage(params: {
  opportunity: OffPageOpportunity;
  page: PageContent | null;
  brandProfile: BrandProfile | null;
  isFollowUp: boolean;
}): Promise<DraftedOutreach> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("AI generation is not configured — ANTHROPIC_API_KEY is missing.");
  }

  const lines = [
    params.isFollowUp
      ? "Write a brief, polite follow-up to a previous outreach email that got no response yet."
      : "Write a first-contact outreach email.",
    `Opportunity type: ${params.opportunity.opportunity_type.replace(/_/g, " ")}`,
    `Target page: ${params.opportunity.url}`,
  ];
  if (params.page) {
    lines.push(`Target page title: ${params.page.title || "(none)"}`);
    lines.push(`Target page content (truncated): ${params.page.textContent.slice(0, 1500)}`);
  }
  if (params.brandProfile?.business_description) {
    lines.push(`Client's business: ${params.brandProfile.business_description}`);
  }
  if (params.brandProfile?.preferred_tone) {
    lines.push(`Client's preferred tone: ${params.brandProfile.preferred_tone}`);
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
    return {
      subject: typeof parsed.subject === "string" ? parsed.subject : "Quick note",
      body: typeof parsed.body === "string" ? parsed.body : textBlock.text,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new AiGenerationError(`AI generation failed: ${error.message}`);
    }
    throw error;
  }
}
