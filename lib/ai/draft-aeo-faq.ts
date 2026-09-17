import { generateText } from "@/lib/ai/provider";
import { AiGenerationError } from "@/lib/ai/client";
import type { AiUsage } from "@/lib/ai/log-usage";
import type { AeoFinding, BrandProfile } from "@/types/database";

export interface DraftedAeoFaq {
  faqDraft: string;
  usage: AiUsage;
}

// Q&A pairs come back as an array of single-line {question, answer} objects
// rather than one big multi-line string — asking a model for embedded
// "\n" inside a JSON string value is unreliable (it very often emits a
// literal newline instead of the escaped sequence, which is invalid JSON
// and fails every retry, not just an occasional truncation). The multi-line
// FAQ text is assembled server-side from the parsed array instead.
const SYSTEM_PROMPT = `You write a short FAQ section (4-6 question/answer pairs) for a local business's own website, aimed at giving AI answer engines (ChatGPT, Gemini, Perplexity, Google AI Overviews) clear, quotable facts about the business.
Rules:
- Each answer is 1-3 sentences, specific and factual (what the business offers, where it is, hours, what makes it different) — never invented facts; use only what's given below.
- Cover the specific gaps you're told about first (e.g. if location isn't clear on the site, include a "where are you located" question).
- Never guarantee AI-engine visibility, rankings, or any specific outcome from adding this content.
- Each question and each answer must be a single line of plain text — no line breaks inside a question or answer.
Respond with ONLY a JSON object: {"pairs": [{"question": string, "answer": string}]}`;

export async function draftAeoFaq(params: {
  findings: AeoFinding[];
  brandProfile: BrandProfile | null;
  businessName: string;
  url: string;
}): Promise<DraftedAeoFaq> {
  const { findings, brandProfile, businessName, url } = params;
  const lines = [`Business name: ${businessName}`, `Website: ${url}`];
  if (brandProfile?.business_description) lines.push(`Business: ${brandProfile.business_description}`);
  if (brandProfile?.products_services) lines.push(`Products/services: ${brandProfile.products_services}`);
  if (brandProfile?.locations) lines.push(`Location(s): ${brandProfile.locations}`);
  if (brandProfile?.phone || brandProfile?.whatsapp) lines.push(`Contact: ${brandProfile.whatsapp || brandProfile.phone}`);
  if (brandProfile?.offers) lines.push(`Current offers: ${brandProfile.offers}`);

  const gaps = findings.filter((f) => f.status !== "good");
  lines.push("Gaps found on the current site (address these first):");
  gaps.forEach((g) => lines.push(`- [${g.area}] ${g.message}`));

  const result = await generateText({ system: SYSTEM_PROMPT, user: lines.join("\n"), maxTokens: 1024 });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
  } catch {
    throw new AiGenerationError("Couldn't generate clean FAQ content that time — please try again.");
  }

  const pairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];
  const faqDraft = pairs
    .filter((p): p is { question: string; answer: string } => typeof p?.question === "string" && typeof p?.answer === "string")
    .map((p) => `Q: ${p.question}\nA: ${p.answer}`)
    .join("\n\n");

  if (!faqDraft) throw new AiGenerationError("Couldn't generate clean FAQ content that time — please try again.");

  return { faqDraft, usage: result.usage };
}
