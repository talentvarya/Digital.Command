// Revenue/plan pricing throughout this app is in INR; AI cost (Anthropic)
// and the manual Buffer/storage/other cost fields are all naturally USD
// (that's the currency VMG is actually billed in for each of them). This
// rate lets the Cost Dashboard show one combined margin figure rather than
// two costs in a currency nobody can compare to revenue at a glance.
// Approximate, not live-fetched — re-check periodically.
export const USD_TO_INR_RATE = 83;

export function usdToInr(usd: number): number {
  return usd * USD_TO_INR_RATE;
}
