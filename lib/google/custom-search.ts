import type { BrandMentionResult } from "@/types/database";

// Google Programmable Search Engine (Custom Search JSON API) — simple API-key
// auth (no OAuth, no per-org connection), free tier 100 queries/day. Used for
// spec §9.2's "unlinked brand mentions" without a paid monitoring platform.
// App-wide credential (GOOGLE_CUSTOM_SEARCH_API_KEY / _ENGINE_ID), not per-org.

export class CustomSearchError extends Error {}

export async function searchBrandMentions(query: string): Promise<BrandMentionResult[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) {
    throw new CustomSearchError("Brand mention search is not configured — GOOGLE_CUSTOM_SEARCH_API_KEY/ENGINE_ID are missing.");
  }

  const params = new URLSearchParams({ key: apiKey, cx: engineId, q: query, num: "10" });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  if (!res.ok) {
    throw new CustomSearchError(`Custom Search API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: { title: string; link: string; snippet: string }) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
  }));
}
