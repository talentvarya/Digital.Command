// Did an AI-generated answer name this business, cite its website, or name its
// competitors? Pure text analysis — no network, no AI — so it is deterministic
// and testable. Matching is on whole words after lower-casing and stripping
// punctuation, so "Aura Lux" is found in "…try Aura Lux, a Pune brand…" but a
// short brand name isn't matched inside an unrelated longer word.
const LEGAL_SUFFIX = /\s*\b(pvt\.?|private|ltd\.?|limited|llp|inc\.?|co\.?|company|enterprises?|corp\.?|corporation)\s*\.?\s*$/i;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Very short names ("Co", "AL") would match constantly by accident.
const MIN_NAME_LENGTH = 4;

export function brandNameVariants(legalName: string): string[] {
  const full = legalName.trim();
  let stripped = full;
  for (let i = 0; i < 3; i++) stripped = stripped.replace(LEGAL_SUFFIX, "").trim();
  return [...new Set([full, stripped])].filter((v) => normalize(v).length >= MIN_NAME_LENGTH);
}

function containsPhrase(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  if (n.length < MIN_NAME_LENGTH) return false;
  return ` ${normalize(haystack)} `.includes(` ${n} `);
}

export interface BrandIdentity {
  names: string[];
  domain: string | null;
  competitors: string[];
}

export interface AnswerInput {
  text: string | null;
  sources: { title: string | null; url: string }[];
}

export interface AnswerAnalysis {
  mentioned: boolean;
  cited: boolean;
  competitorsMentioned: string[];
  excerpt: string | null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function analyzeAnswer(answer: AnswerInput, brand: BrandIdentity): AnswerAnalysis {
  const text = answer.text ?? "";
  const domain = brand.domain ? brand.domain.replace(/^www\./, "").toLowerCase() : null;

  const mentioned =
    brand.names.some((n) => containsPhrase(text, n)) || (domain !== null && containsPhrase(text, domain));

  const cited =
    domain !== null &&
    answer.sources.some((s) => {
      const host = hostOf(s.url);
      return host !== null && (host === domain || host.endsWith(`.${domain}`));
    });

  const ownNames = new Set(brand.names.map(normalize));
  const competitorsMentioned = brand.competitors
    .map((c) => c.trim())
    .filter((c) => c && !ownNames.has(normalize(c)) && containsPhrase(text, c));

  return { mentioned, cited, competitorsMentioned, excerpt: excerpt(text) };
}

function excerpt(text: string, max = 280): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max)}…`;
}
