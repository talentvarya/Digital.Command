// Calls Apify's REST API directly (no SDK dependency, same pattern as
// lib/google/*'s raw-fetch OAuth clients) using the CLIENT's OWN Apify API
// token — usage is billed to their own Apify account, never VMG's. Actor id
// is apify/google-search-scraper (official Apify actor, verified via
// fetch-actor-details before writing this — id "nFJndFXA5zjCTuudP"), called
// through the run-sync-get-dataset-items endpoint so a single request both
// runs the actor and returns its results, no polling needed.
const GOOGLE_SEARCH_SCRAPER_ACTOR_ID = "nFJndFXA5zjCTuudP";

export interface ApifyOrganicResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string;
}

export interface CompetitorSearchResult {
  topResults: ApifyOrganicResult[];
  ownDomainPosition: number | null;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url;
  }
}

export class ApifyError extends Error {}

export async function runCompetitorSearch(params: {
  apiToken: string;
  query: string;
  countryCode: string;
  ownDomain: string | null;
}): Promise<CompetitorSearchResult> {
  const { apiToken, query, countryCode, ownDomain } = params;

  const res = await fetch(
    `https://api.apify.com/v2/acts/${GOOGLE_SEARCH_SCRAPER_ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(apiToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: query, maxPagesPerQuery: 1, countryCode }),
    }
  );

  if (!res.ok) {
    let message = `Apify request failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // response body wasn't JSON — keep the generic HTTP-status message
    }
    if (res.status === 401) message = "Apify API token is invalid or expired.";
    throw new ApifyError(message);
  }

  const items = (await res.json()) as Array<{ organicResults?: unknown[] }>;
  const rawResults = (items[0]?.organicResults ?? []) as Array<{
    position?: number;
    title?: string;
    url?: string;
    description?: string;
  }>;

  const topResults: ApifyOrganicResult[] = rawResults
    .filter((r) => r.url && r.title)
    .map((r, i) => ({
      position: r.position ?? i + 1,
      title: r.title as string,
      url: r.url as string,
      domain: extractDomain(r.url as string),
      description: r.description ?? "",
    }));

  const normalizedOwnDomain = ownDomain ? ownDomain.replace(/^www\./, "").toLowerCase() : null;
  const ownMatch = normalizedOwnDomain ? topResults.find((r) => r.domain === normalizedOwnDomain) : undefined;

  return { topResults, ownDomainPosition: ownMatch?.position ?? null };
}
