import { apifyRunSync } from "@/lib/apify/client";

// Runs Apify's official Google Search Results Scraper (actor nFJndFXA5zjCTuudP)
// with its "Google AI Mode" add-on and reads back what Google's AI actually
// answered for each query. Scope note: AI Mode is the only engine wired up
// because it is the only add-on whose output shape (aiModeResult.text +
// aiModeResult.sources[{title,url}]) is documented with a real example. The
// ChatGPT / Perplexity / Gemini / Copilot / AI Overview add-ons exist, but their
// output property names aren't documented, and guessing them would mean
// charging the client real money for results we might silently misread — they
// get added once a real run has confirmed the shape (the raw payload of every
// check is stored precisely to make that verification possible).
const GOOGLE_SEARCH_SCRAPER_ACTOR_ID = "nFJndFXA5zjCTuudP";

export const MAX_AI_CHECK_QUERIES = 5;

// Per query at Apify's FREE-tier prices: AI Mode add-on $0.20 + result page
// $0.0045 + run start $0.001. Cheaper on paid Apify plans.
export const AI_MODE_COST_PER_QUERY_USD = 0.21;

export interface AiAnswerSource {
  title: string | null;
  url: string;
}

export interface AiAnswer {
  query: string;
  answered: boolean;
  text: string | null;
  sources: AiAnswerSource[];
  raw: unknown | null;
}

interface SearchItem {
  searchQuery?: { term?: string };
  aiModeResult?: { text?: unknown; sources?: unknown };
}

export async function runAiModeCheck(params: {
  apiToken: string;
  queries: string[];
  countryCode?: string;
}): Promise<AiAnswer[]> {
  const { apiToken, queries, countryCode = "in" } = params;

  const items = await apifyRunSync<SearchItem>(GOOGLE_SEARCH_SCRAPER_ACTOR_ID, apiToken, {
    queries: queries.join("\n"),
    maxPagesPerQuery: 1,
    countryCode,
    aiModeSearch: { enableAiMode: true },
  });

  return queries.map((query, i) => {
    const item =
      items.find((it) => it.searchQuery?.term?.trim().toLowerCase() === query.trim().toLowerCase()) ??
      (items.length === queries.length ? items[i] : undefined);
    const result = item?.aiModeResult;
    const text = typeof result?.text === "string" && result.text.trim() ? result.text : null;
    const sources: AiAnswerSource[] = Array.isArray(result?.sources)
      ? (result.sources as Array<{ title?: unknown; url?: unknown }>)
          .filter((s) => typeof s?.url === "string")
          .map((s) => ({ title: typeof s.title === "string" ? s.title : null, url: s.url as string }))
      : [];
    return { query, answered: text !== null, text, sources, raw: result ?? null };
  });
}
