import { generateText } from "@/lib/ai/provider";
import { estimateAiCostUsd } from "@/lib/constants/ai-pricing";
import { AiGenerationError } from "@/lib/ai/client";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { RoadmapPhase } from "@/types/database";
import type { RoadmapLanguage } from "@/lib/i18n/roadmap";

export interface RoadmapLeadInput {
  businessName: string;
  industry: string;
  city: string;
  currentWebsite: string;
  currentSocial: string;
  currentReviews: string;
  currentMarketing: string;
  primaryGoal: string;
  timeline: string;
  budgetRange: string;
  targetAudience: string;
  competitors: string;
  brandTone: string;
  productsOffers: string;
  language: RoadmapLanguage;
}

export interface GeneratedRoadmap {
  currentState: string[];
  phases: RoadmapPhase[];
  vision: string;
  urgencyLine: string;
  estimatedCostUsd: number;
  usage: AiUsage;
}

// This is a free lead-magnet, not a paying client's content — but it's still
// bound by the same "never guarantee outcomes" discipline every other
// AI-generation call site in this app follows (see generate-report.ts,
// draft-outreach.ts). Exciting and aspirational is the whole point of this
// tool; a false promise would be a real legal-shaped risk, not just a bug.
function systemPrompt(language: RoadmapLanguage): string {
  const languageLine =
    language === "hi"
      ? "Write in warm, energetic Hinglish (Hindi-English mix, Roman script) — the same way a friendly local sales conversation actually sounds, not stiff corporate English."
      : "Write in warm, energetic, plain English — the same way a friendly, confident local sales conversation actually sounds, not stiff corporate jargon.";
  return `You write an exciting, personalized digital-marketing growth roadmap for a small/local Indian business owner, as a free lead-magnet sales tool for a marketing agency (Visionary Masters Global / Digital Command).
${languageLine}
Tone: vivid and genuinely exciting to read — paint a specific picture of what their business could look and feel like, using details they actually gave you. Make them want to pick up the phone right now.
Hard rules (never break these):
- NEVER promise a specific guaranteed outcome, number, ranking, or timeline as certain ("you'll get 500 leads", "you'll rank #1"). Aspirational and vivid is fine; a guarantee is not.
- NEVER invent facts about their business you weren't given — only use what's in the input.
- Reference specific real details from their answers (business name, industry, city, current gaps) so it reads as genuinely personalized, not generic.
- "vision": 3-4 sentences, second person ("Imagine...", "Picture this..."), concrete and sensory, ending on an aspirational high note — this is the emotional peak of the whole page.
- "urgencyLine": ONE punchy sentence creating gentle urgency/FOMO (e.g. competitors moving faster while they wait) — no fear-mongering, no fake scarcity ("only 2 spots left" type claims).
- "currentState": 2-4 short bullets naming real gaps based on what they told you (e.g. no reviews, inconsistent posting, no SEO) — honest, not harsh.
- "phases": exactly 4 phases for a realistic 90-day rollout, each with a short title, a timeframe ("Week 1-2", "Week 3-4", "Month 2", "Month 3"), and 2-3 short bullet points.
Respond with ONLY a JSON object: {"currentState": string[], "phases": [{"title": string, "timeframe": string, "points": string[]}], "vision": string, "urgencyLine": string}`;
}

export async function generateRoadmap(input: RoadmapLeadInput): Promise<GeneratedRoadmap> {
  const lines = [
    `Business name: ${input.businessName}`,
    `Industry: ${input.industry || "not given"}`,
    `City: ${input.city || "not given"}`,
    `Current website: ${input.currentWebsite || "none"}`,
    `Current social media: ${input.currentSocial || "none/inactive"}`,
    `Current reviews: ${input.currentReviews || "none/unknown"}`,
    `Current marketing effort: ${input.currentMarketing || "none"}`,
    `Primary goal: ${input.primaryGoal || "more customers"}`,
    `Desired timeline: ${input.timeline || "not given"}`,
    `Budget range: ${input.budgetRange || "not given"}`,
    `Target audience: ${input.targetAudience || "not given"}`,
    `Competitors they mentioned: ${input.competitors || "not given"}`,
    `Preferred brand tone: ${input.brandTone || "not given"}`,
    `Products/services/offers: ${input.productsOffers || "not given"}`,
  ];

  // 2048, not the 256-512 other draft-* call sites use — this response has
  // to carry 4 full phases plus vision/urgency copy, and a truncated
  // response is invalid JSON, not just short.
  const result = await generateText({ system: systemPrompt(input.language), user: lines.join("\n"), maxTokens: 2048 });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
  } catch {
    throw new AiGenerationError(
      input.language === "hi"
        ? "Is baar ek saaf roadmap nahi ban paaya — please dubara try karein."
        : "Couldn't generate a clean roadmap that time — please try again."
    );
  }

  return {
    currentState: Array.isArray(parsed.currentState) ? parsed.currentState : [],
    phases: Array.isArray(parsed.phases) ? parsed.phases : [],
    vision: typeof parsed.vision === "string" ? parsed.vision : "",
    urgencyLine: typeof parsed.urgencyLine === "string" ? parsed.urgencyLine : "",
    estimatedCostUsd: estimateAiCostUsd(result.usage.provider, result.usage.inputTokens, result.usage.outputTokens),
    usage: result.usage,
  };
}
