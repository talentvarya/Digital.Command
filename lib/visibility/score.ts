// A single, transparent "how ready is this business to be found" number built
// ONLY from checks Digital Command actually runs on the client's own presence.
// It is not a Google or AI ranking and is never presented as one. Each
// component is 0-100; the overall figure is the plain average of whichever
// components have been measured, so what's missing is visible instead of
// silently counted as zero.
export interface VisibilityInput {
  seoScore: number | null;
  aeoScore: number | null;
  napFilled: number;
  napTotal: number;
  citationsDone: number;
  citationsTotal: number;
}

export interface VisibilityComponent {
  key: "seo" | "aeo" | "nap" | "citations";
  label: string;
  value: number | null;
  detail: string;
  href: string;
}

export interface VisibilityScore {
  components: VisibilityComponent[];
  overall: number | null;
  measured: number;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function computeVisibility(input: VisibilityInput): VisibilityScore {
  const components: VisibilityComponent[] = [
    {
      key: "seo",
      label: "Website health (SEO audit)",
      value: input.seoScore === null ? null : clamp(input.seoScore),
      detail: input.seoScore === null ? "Not measured yet — run an SEO audit." : "From your latest technical SEO audit.",
      href: "/app/seo",
    },
    {
      key: "aeo",
      label: "AI-readiness (AI Search audit)",
      value: input.aeoScore === null ? null : clamp(input.aeoScore),
      detail: input.aeoScore === null ? "Not measured yet — run an AI Search Visibility audit." : "From your latest AI Search Visibility audit.",
      href: "/app/ai-visibility",
    },
    {
      key: "nap",
      label: "Business info consistency (NAP)",
      value: pct(input.napFilled, input.napTotal),
      detail: `${input.napFilled} of ${input.napTotal} essentials filled in.`,
      href: "/app/local-seo",
    },
    {
      key: "citations",
      label: "Directory listings",
      value: pct(input.citationsDone, input.citationsTotal),
      detail: `Listed on ${input.citationsDone} of ${input.citationsTotal} common directories.`,
      href: "/app/local-seo",
    },
  ];

  const measured = components.filter((c) => c.value !== null);
  const overall = measured.length
    ? Math.round(measured.reduce((sum, c) => sum + (c.value as number), 0) / measured.length)
    : null;

  return { components, overall, measured: measured.length };
}
