import * as cheerio from "cheerio";
import { fetchWithTimeout } from "@/lib/web/fetch-page";
import type { AeoFinding } from "@/types/database";

export interface AeoAuditResult {
  score: number;
  findings: AeoFinding[];
}

const QUESTION_WORDS = /^(what|why|how|when|where|who|which|can|does|do|is|are)\b/i;

// Real crawl-based checks of the on-page signals AI answer engines are known
// to rely on when pulling facts about a local business — structured data,
// FAQ-shaped content, plain NAP text, review/testimonial signals. This is
// NOT a live query of ChatGPT/Gemini/Perplexity (no such API exists) — see
// migration 0029's header comment for why that's a deliberate line, not a
// gap.
export async function runAeoAudit(baseUrl: string): Promise<AeoAuditResult> {
  const findings: AeoFinding[] = [];
  let score = 100;
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  let html = "";
  try {
    const res = await fetchWithTimeout(normalizedBase);
    if (!res.ok) {
      findings.push({ status: "missing", area: "homepage", message: `Homepage returned HTTP ${res.status}` });
      score -= 40;
    } else {
      html = await res.text();
    }
  } catch {
    findings.push({ status: "missing", area: "homepage", message: "Homepage not reachable" });
    score -= 40;
  }

  if (!html) return { score: Math.max(0, score), findings };

  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const ldJsonBlocks = $('script[type="application/ld+json"]');
  if (ldJsonBlocks.length === 0) {
    findings.push({
      status: "missing",
      area: "structured_data",
      message: "No JSON-LD structured data found — AI engines lean on this for hard facts (name, address, hours, category).",
    });
    score -= 20;
  } else {
    let hasLocalBusinessSchema = false;
    ldJsonBlocks.each((_, el) => {
      const raw = $(el).contents().text();
      if (/"@type"\s*:\s*"(LocalBusiness|Organization|Store|Restaurant)"/i.test(raw)) hasLocalBusinessSchema = true;
    });
    if (hasLocalBusinessSchema) {
      findings.push({ status: "good", area: "structured_data", message: "LocalBusiness/Organization structured data found." });
    } else {
      findings.push({
        status: "needs_work",
        area: "structured_data",
        message: "JSON-LD found but no LocalBusiness/Organization type detected.",
      });
      score -= 10;
    }
  }

  const faqSchema = ldJsonBlocks.filter((_, el) => /"@type"\s*:\s*"FAQPage"/i.test($(el).contents().text())).length > 0;
  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().trim())
    .get();
  const questionHeadings = headings.filter((h) => QUESTION_WORDS.test(h) || h.includes("?"));
  if (faqSchema || questionHeadings.length >= 3) {
    findings.push({
      status: "good",
      area: "faq_content",
      message: faqSchema ? "FAQPage structured data found." : `${questionHeadings.length} question-style headings found — reads like FAQ content.`,
    });
  } else if (questionHeadings.length > 0) {
    findings.push({
      status: "needs_work",
      area: "faq_content",
      message: `Only ${questionHeadings.length} question-style heading(s) found — a short FAQ section gives AI engines more to quote.`,
    });
    score -= 8;
  } else {
    findings.push({
      status: "missing",
      area: "faq_content",
      message: "No FAQ-style content found — questions like \"where are you located\" or \"what do you offer\" aren't answered in plain text anywhere.",
    });
    score -= 15;
  }

  const phonePattern = /(\+?\d[\d\s-]{7,}\d)/;
  const hasPhoneText = phonePattern.test(bodyText);
  const addressWords = /\b(road|street|st\.|nagar|colony|sector|floor|near|opposite)\b/i;
  const hasAddressText = addressWords.test(bodyText);
  if (hasPhoneText && hasAddressText) {
    findings.push({ status: "good", area: "nap_text", message: "Phone number and address-style text both found on the page." });
  } else {
    findings.push({
      status: hasPhoneText || hasAddressText ? "needs_work" : "missing",
      area: "nap_text",
      message: "Plain-text name/address/phone isn't clearly present on the page — AI engines quote text they can find, not just structured data.",
    });
    score -= 12;
  }

  const reviewWords = /\b(review|rating|testimonial|customers say|★|stars)\b/i;
  if (reviewWords.test(bodyText)) {
    findings.push({ status: "good", area: "trust_signals", message: "Review/testimonial language found on the page." });
  } else {
    findings.push({
      status: "needs_work",
      area: "trust_signals",
      message: "No visible review or testimonial mentions — social proof helps an AI engine describe the business favorably.",
    });
    score -= 8;
  }

  const title = $("title").first().text().trim();
  if (!title || title.length < 10) {
    findings.push({ status: "needs_work", area: "page_title", message: "Page title is missing or very short — give AI engines a clear one-line description." });
    score -= 7;
  } else {
    findings.push({ status: "good", area: "page_title", message: "Descriptive page title found." });
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), findings };
}
