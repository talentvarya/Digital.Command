// Calls Apify's REST API directly (no SDK dependency, same pattern as
// lib/google/*'s raw-fetch OAuth clients) using the CLIENT's OWN Apify API
// token — usage is billed to their own Apify account, never VMG's. Actor is
// the Google Maps Scraper (compass/crawler-google-places, id
// "nwua9Gu5YrADL7ZDj") — chosen over a generic Google-search scraper because
// it's what actually matters for a local business: who else shows up on the
// map for the same search, their rating/review count/category, not generic
// web-page rankings. Actor id, input shape, and every output field below
// were confirmed via a real live run before writing this, not guessed.
const GOOGLE_MAPS_SCRAPER_ACTOR_ID = "nwua9Gu5YrADL7ZDj";

export interface ApifyMapsResult {
  rank: number;
  businessName: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  rating: number | null;
  reviewsCount: number | null;
  mapsUrl: string | null;
}

export interface CompetitorSearchResult {
  topResults: ApifyMapsResult[];
  ownDomainPosition: number | null;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export class ApifyError extends Error {}

export async function runCompetitorSearch(params: {
  apiToken: string;
  query: string;
  location: string;
  ownDomain: string | null;
}): Promise<CompetitorSearchResult> {
  const { apiToken, query, location, ownDomain } = params;

  const res = await fetch(
    `https://api.apify.com/v2/acts/${GOOGLE_MAPS_SCRAPER_ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(apiToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [query],
        locationQuery: location,
        maxCrawledPlacesPerSearch: 20,
        language: "en",
      }),
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

  const items = (await res.json()) as Array<{
    rank?: number;
    title?: string;
    categoryName?: string;
    address?: string;
    phone?: string;
    website?: string;
    totalScore?: number;
    reviewsCount?: number;
    url?: string;
  }>;

  const topResults: ApifyMapsResult[] = items
    .filter((r) => r.title)
    .map((r, i) => ({
      rank: r.rank ?? i + 1,
      businessName: r.title as string,
      category: r.categoryName ?? null,
      address: r.address ?? null,
      phone: r.phone ?? null,
      website: r.website ?? null,
      domain: r.website ? extractDomain(r.website) : null,
      rating: r.totalScore ?? null,
      reviewsCount: r.reviewsCount ?? null,
      mapsUrl: r.url ?? null,
    }))
    .sort((a, b) => a.rank - b.rank);

  const normalizedOwnDomain = ownDomain ? ownDomain.replace(/^www\./, "").toLowerCase() : null;
  const ownMatch = normalizedOwnDomain ? topResults.find((r) => r.domain === normalizedOwnDomain) : undefined;

  return { topResults, ownDomainPosition: ownMatch?.rank ?? null };
}
