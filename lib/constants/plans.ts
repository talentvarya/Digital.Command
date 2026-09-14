export const PLAN_DISPLAY = {
  package_a: {
    name: "Package A",
    tagline: "1 Website + 1 SMO Package",
    includes: ["1 Website", "1 SMO Package: Facebook, Instagram, YouTube"],
    pricing: { quarterly: 34999, half_yearly: 64999, yearly: 119999 },
  },
  package_b: {
    name: "Package B",
    tagline: "2 Websites + 2 SMO Packages",
    includes: ["2 Websites", "2 SMO Packages: Facebook, Instagram, YouTube (each)"],
    pricing: { quarterly: 54999, half_yearly: 99999, yearly: 179999 },
  },
  custom: {
    name: "Custom / Enterprise",
    tagline: "More than 2 websites or brands",
    includes: ["Tailored scope for larger portfolios"],
    pricing: { quarterly: null, half_yearly: null, yearly: null },
  },
} as const;

export const BILLING_TERM_LABELS = {
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  yearly: "Yearly",
} as const;

const BILLING_TERM_MONTHS: Record<string, number> = { quarterly: 3, half_yearly: 6, yearly: 12 };

// Normalizes any billing term to a monthly-equivalent figure so revenue is
// comparable to a monthly AI-cost window (spec §30's margin calculation).
export function monthlyEquivalent(price: number | null, billingTerm: string): number {
  if (price === null) return 0;
  const months = BILLING_TERM_MONTHS[billingTerm] ?? 1;
  return price / months;
}

export function formatInr(amount: number | null): string {
  if (amount === null) return "Custom pricing";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
