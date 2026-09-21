import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeAnswer, brandNameVariants } from "@/lib/aeo/mentions";
import { runAiModeCheck } from "@/lib/apify/ai-visibility";

describe("brandNameVariants", () => {
  it("adds a version without legal suffixes", () => {
    expect(brandNameVariants("Aura Lux Chocolate Co.")).toEqual(["Aura Lux Chocolate Co.", "Aura Lux Chocolate"]);
    expect(brandNameVariants("Sharma Sweets Pvt. Ltd.")).toEqual(["Sharma Sweets Pvt. Ltd.", "Sharma Sweets"]);
  });

  it("drops names too short to match safely", () => {
    expect(brandNameVariants("Co")).toEqual([]);
  });
});

const BRAND = { names: ["Aura Lux Chocolate Co.", "Aura Lux Chocolate"], domain: "auralux.example", competitors: ["Smoor", "Choco Twisto", "aura lux chocolate"] };

describe("analyzeAnswer", () => {
  it("detects a brand mention regardless of case and punctuation", () => {
    const a = analyzeAnswer({ text: "For gifting, try AURA-LUX chocolate or Smoor.", sources: [] }, { ...BRAND, names: ["Aura Lux"] });
    expect(a.mentioned).toBe(true);
  });

  it("does not match a name inside a longer unrelated word", () => {
    const a = analyzeAnswer({ text: "Baurauxlux and similar words.", sources: [] }, { ...BRAND, names: ["Aura Lux"] });
    expect(a.mentioned).toBe(false);
  });

  it("detects the website domain written in the answer text", () => {
    expect(analyzeAnswer({ text: "See auralux.example for the menu.", sources: [] }, BRAND).mentioned).toBe(true);
  });

  it("treats a source on the brand's domain (or a subdomain) as a citation, but not a look-alike domain", () => {
    const cited = (url: string) => analyzeAnswer({ text: "x", sources: [{ title: null, url }] }, BRAND).cited;
    expect(cited("https://www.auralux.example/shop")).toBe(true);
    expect(cited("https://blog.auralux.example/post")).toBe(true);
    expect(cited("https://notauralux.example/")).toBe(false);
    expect(cited("https://justdial.com/auralux")).toBe(false);
  });

  it("lists competitors named in the answer, excluding the brand itself", () => {
    const a = analyzeAnswer({ text: "Top picks: Smoor, Choco Twisto and Aura Lux Chocolate.", sources: [] }, BRAND);
    expect(a.competitorsMentioned).toEqual(["Smoor", "Choco Twisto"]);
    expect(a.mentioned).toBe(true);
  });

  it("reports nothing for an empty answer", () => {
    expect(analyzeAnswer({ text: null, sources: [] }, BRAND)).toEqual({ mentioned: false, cited: false, competitorsMentioned: [], excerpt: null });
  });

  it("shortens a long answer to a word-boundary excerpt", () => {
    const long = "word ".repeat(200);
    const { excerpt } = analyzeAnswer({ text: long, sources: [] }, BRAND);
    expect(excerpt!.length).toBeLessThanOrEqual(281);
    expect(excerpt!.endsWith("…")).toBe(true);
  });
});

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

describe("runAiModeCheck", () => {
  it("sends the queries with the AI Mode add-on enabled", async () => {
    const fetchMock = stubFetch([]);
    await runAiModeCheck({ apiToken: "t", queries: ["best chocolate shop in pune", "gift hampers pune"] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v2/acts/nFJndFXA5zjCTuudP/run-sync-get-dataset-items");
    expect(JSON.parse(init.body)).toMatchObject({
      queries: "best chocolate shop in pune\ngift hampers pune",
      aiModeSearch: { enableAiMode: true },
    });
  });

  it("matches answers to queries by search term, and reads text and sources", async () => {
    stubFetch([
      { searchQuery: { term: "gift hampers pune" }, aiModeResult: { text: "Try Aura Lux.", sources: [{ title: "Aura Lux", url: "https://auralux.example" }, { nope: 1 }] } },
      { searchQuery: { term: "Best Chocolate Shop In Pune" }, aiModeResult: { text: "Smoor is popular.", sources: [] } },
    ]);
    const out = await runAiModeCheck({ apiToken: "t", queries: ["best chocolate shop in pune", "gift hampers pune"] });
    expect(out[0]).toMatchObject({ query: "best chocolate shop in pune", answered: true, text: "Smoor is popular." });
    expect(out[1]).toMatchObject({ query: "gift hampers pune", answered: true, sources: [{ title: "Aura Lux", url: "https://auralux.example" }] });
  });

  it("marks a query unanswered when Google returned no AI Mode result for it", async () => {
    stubFetch([{ searchQuery: { term: "some query" } }]);
    const [only] = await runAiModeCheck({ apiToken: "t", queries: ["some query"] });
    expect(only).toMatchObject({ answered: false, text: null, sources: [], raw: null });
  });

  it("keeps the raw AI Mode payload so a real run can verify the format", async () => {
    stubFetch([{ searchQuery: { term: "q" }, aiModeResult: { engine: "AI Mode", text: "hi", extra: 1 } }]);
    const [only] = await runAiModeCheck({ apiToken: "t", queries: ["q"] });
    expect(only.raw).toEqual({ engine: "AI Mode", text: "hi", extra: 1 });
  });
});
