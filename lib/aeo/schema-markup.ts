// Deterministic schema.org JSON-LD for a local business, built ONLY from facts
// the client has already entered (Brand Brain, Local SEO profile, connected
// links). No AI, and nothing is invented: a field with no data is left out
// rather than guessed (in particular no country is assumed), and the caller is
// told which fields were missing so the client knows what would make it fuller.
// Structured data makes facts unambiguous for search and AI engines to read;
// it does not guarantee any ranking, rich result, or AI mention.
export interface BusinessSchemaInput {
  name: string;
  description?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  category?: string | null;
  sameAs?: string[];
}

const clean = (v: string | null | undefined) => v?.trim() || undefined;

export function buildLocalBusinessJsonLd(input: BusinessSchemaInput): { json: Record<string, unknown>; missing: string[] } {
  const address = {
    streetAddress: clean(input.streetAddress),
    addressLocality: clean(input.city),
    addressRegion: clean(input.state),
    postalCode: clean(input.pincode),
  };
  const hasAddress = Object.values(address).some(Boolean);
  const sameAs = (input.sameAs ?? []).map((u) => u.trim()).filter(Boolean);

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.name.trim(),
    description: clean(input.description),
    url: clean(input.websiteUrl),
    telephone: clean(input.phone),
    address: hasAddress ? { "@type": "PostalAddress", ...stripUndefined(address) } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const missing: string[] = [];
  if (!clean(input.description)) missing.push("business description");
  if (!clean(input.websiteUrl)) missing.push("website");
  if (!clean(input.phone)) missing.push("phone");
  if (!hasAddress) missing.push("address");
  if (!sameAs.length) missing.push("social/profile links");

  return { json: stripUndefined(json), missing };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export interface FaqPair {
  question: string;
  answer: string;
}

// Reads the "Q: ...\nA: ...\n\nQ: ..." text the FAQ drafter produces (and that
// the client may have edited by hand). Blocks that don't fit the shape are
// skipped rather than guessed at.
export function parseFaqPairs(faqText: string): FaqPair[] {
  return faqText
    .split(/\n\s*\n/)
    .map((block) => block.trim().match(/^Q:\s*([\s\S]*?)\s*\n\s*A:\s*([\s\S]+)$/i))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ question: m[1].trim(), answer: m[2].trim() }))
    .filter((p) => p.question && p.answer);
}

export function buildFaqPageJsonLd(pairs: FaqPair[]): Record<string, unknown> | null {
  if (pairs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
}

// "<" is escaped so client-entered text containing "</script>" can never close
// the tag early when this is pasted into a page.
export function toScriptTag(json: Record<string, unknown>): string {
  const body = JSON.stringify(json, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${body}\n</script>`;
}
