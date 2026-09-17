import { generateText } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/client";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { BrandProfile, Review } from "@/types/database";

export interface DraftedReviewReply {
  reply: string;
  usage: AiUsage;
}

const SYSTEM_PROMPT = `You write short, genuine-sounding owner replies to a customer review, on behalf of a small business.
Rules:
- Under 60 words. No corporate boilerplate ("We value your feedback"), no exclamation-mark overload.
- For a positive review (4-5 stars): thank them by name if given, mention something specific from their review if possible.
- For a negative review (1-3 stars): acknowledge the specific issue, apologize without over-admitting fault, invite them to resolve it offline (phone/WhatsApp/email) rather than arguing in public.
- Never admit legal liability or promise a refund/compensation — that's the owner's call, not this reply's.
- Match the client's preferred tone if given.
Respond with ONLY a JSON object: {"reply": string}`;

export async function draftReviewReply(params: {
  review: Review;
  brandProfile: BrandProfile | null;
}): Promise<DraftedReviewReply> {
  const { review, brandProfile } = params;
  const lines = [
    `Platform: ${review.platform}`,
    `Rating: ${review.rating ?? "not given"}/5`,
    `Reviewer name: ${review.reviewer_name ?? "not given"}`,
    `Review text: ${review.review_text ?? "(no text, rating only)"}`,
  ];
  if (brandProfile?.business_description) {
    lines.push(`Client's business: ${brandProfile.business_description}`);
  }
  if (brandProfile?.preferred_tone) {
    lines.push(`Client's preferred tone: ${brandProfile.preferred_tone}`);
  }
  if (brandProfile?.phone || brandProfile?.whatsapp) {
    lines.push(`Contact to offer for offline resolution: ${brandProfile.whatsapp || brandProfile.phone}`);
  }

  const result = await generateText({ system: SYSTEM_PROMPT, user: lines.join("\n"), maxTokens: 256 });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
  } catch {
    throw new AiGenerationError("Couldn't generate a clean reply that time — please try again.");
  }
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : result.text.trim(),
    usage: result.usage,
  };
}
