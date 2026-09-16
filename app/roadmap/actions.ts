"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { generateRoadmap } from "@/lib/ai/generate-roadmap";
import { AiGenerationError } from "@/lib/ai/client";
import type { RoadmapLead } from "@/types/database";

// Safety ceiling on a public, unauthenticated, AI-calling form — same
// reasoning as MONTHLY_AI_GENERATION_SAFETY_CAP elsewhere, just daily since
// this has no login to scope a monthly cap to. Tune freely once real usage
// exists.
const DAILY_ROADMAP_CAP = 30;

export interface RoadmapActionResult {
  error?: string;
  lead?: RoadmapLead;
}

// Public — no requireOrgMember, no login. Runs entirely through the
// service-role client (see 0025's RLS comment for why that's actually
// stricter than an anon-insert policy here, not looser).
//
// Wrapped so an unexpected failure (a bad env var, a transient AI/DB error)
// never surfaces Next.js's generic "server-side exception" crash page to a
// visitor mid-pitch — it logs server-side and shows a plain retry message
// instead, same non-fatal-logging discipline as logAudit/logAiUsage.
export async function generateRoadmapLeadAction(
  _prevState: RoadmapActionResult,
  formData: FormData
): Promise<RoadmapActionResult> {
  try {
    return await handleGenerateRoadmapLead(formData);
  } catch (err) {
    console.error("roadmap lead generation failed", err);
    return { error: "Kuch gadbad ho gayi — ek baar phir try karein." };
  }
}

async function handleGenerateRoadmapLead(formData: FormData): Promise<RoadmapActionResult> {
  // Honeypot — a real visitor never sees this field (hidden via CSS in the
  // form); a bot filling every field usually fills this one too.
  if (((formData.get("company_website") as string) || "").trim()) {
    return {};
  }

  const businessName = ((formData.get("businessName") as string) || "").trim();
  const contactName = ((formData.get("contactName") as string) || "").trim();
  const contactPhone = ((formData.get("contactPhone") as string) || "").trim();
  if (!businessName || !contactName || !contactPhone) {
    return { error: "Business name, your name, and phone number are required." };
  }

  const supabase = createServiceClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("roadmap_leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());
  if ((count ?? 0) >= DAILY_ROADMAP_CAP) {
    return { error: "We've hit today's free-roadmap limit — please try again tomorrow, or just call/WhatsApp us directly." };
  }

  const input = {
    businessName,
    industry: ((formData.get("industry") as string) || "").trim(),
    city: ((formData.get("city") as string) || "").trim(),
    currentWebsite: ((formData.get("currentWebsite") as string) || "").trim(),
    currentSocial: ((formData.get("currentSocial") as string) || "").trim(),
    currentReviews: ((formData.get("currentReviews") as string) || "").trim(),
    currentMarketing: ((formData.get("currentMarketing") as string) || "").trim(),
    primaryGoal: ((formData.get("primaryGoal") as string) || "").trim(),
    timeline: ((formData.get("timeline") as string) || "").trim(),
    budgetRange: ((formData.get("budgetRange") as string) || "").trim(),
    targetAudience: ((formData.get("targetAudience") as string) || "").trim(),
    competitors: ((formData.get("competitors") as string) || "").trim(),
    brandTone: ((formData.get("brandTone") as string) || "").trim(),
    productsOffers: ((formData.get("productsOffers") as string) || "").trim(),
  };

  let generated;
  try {
    generated = await generateRoadmap(input);
  } catch (err) {
    if (err instanceof AiGenerationError) return { error: err.message };
    throw err;
  }

  const { data: lead, error } = await supabase
    .from("roadmap_leads")
    .insert({
      business_name: businessName,
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: ((formData.get("contactEmail") as string) || "").trim() || null,
      industry: input.industry || null,
      city: input.city || null,
      current_website: input.currentWebsite || null,
      current_social: input.currentSocial || null,
      current_reviews: input.currentReviews || null,
      current_marketing: input.currentMarketing || null,
      primary_goal: input.primaryGoal || null,
      timeline: input.timeline || null,
      budget_range: input.budgetRange || null,
      target_audience: input.targetAudience || null,
      competitors: input.competitors || null,
      brand_tone: input.brandTone || null,
      products_offers: input.productsOffers || null,
      roadmap_current_state: generated.currentState,
      roadmap_phases: generated.phases,
      roadmap_vision: generated.vision,
      roadmap_urgency_line: generated.urgencyLine,
      estimated_ai_cost_usd: generated.estimatedCostUsd,
    })
    .select("*")
    .single();
  if (error || !lead) return { error: error?.message ?? "Could not save your roadmap — please try again." };

  return { lead: lead as RoadmapLead };
}
