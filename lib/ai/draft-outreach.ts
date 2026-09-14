import { generateText } from "@/lib/ai/provider";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { BrandProfile, OffPageOpportunity } from "@/types/database";
import type { PageContent } from "@/lib/web/fetch-page";

export interface DraftedOutreach {
  subject: string;
  body: string;
  usage: AiUsage;
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

  const result = await generateText({ system: SYSTEM_PROMPT, user: lines.join("\n"), maxTokens: 512 });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
  return {
    subject: typeof parsed.subject === "string" ? parsed.subject : "Quick note",
    body: typeof parsed.body === "string" ? parsed.body : result.text,
    usage: result.usage,
  };
}
