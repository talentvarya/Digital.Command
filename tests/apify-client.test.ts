import { afterEach, describe, expect, it, vi } from "vitest";
import { ApifyError, runCompetitorSearch } from "@/lib/apify/client";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

const params = { apiToken: "tok en", query: "chocolate shop", location: "Pune, India", ownDomain: "www.owncompany.com" };

describe("runCompetitorSearch", () => {
  it("calls the Maps scraper actor with the client's own token and the search input", async () => {
    const fetchMock = stubFetch([]);
    await runCompetitorSearch(params);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items");
    expect(url).toContain("token=tok%20en");
    expect(JSON.parse(init.body)).toMatchObject({
      searchStringsArray: ["chocolate shop"],
      locationQuery: "Pune, India",
    });
  });

  it("maps fields, sorts by rank, drops nameless rows, and finds the client's own rank by domain", async () => {
    stubFetch([
      { rank: 2, title: "B Shop", website: "https://www.bshop.com/menu", totalScore: 4.5, reviewsCount: 10, categoryName: "Chocolate shop", address: "Baner", phone: "111", url: "https://maps/b" },
      { rank: 1, title: "Own Co", website: "https://owncompany.com", totalScore: 4.9 },
      { rank: 3, title: "" },
    ]);
    const result = await runCompetitorSearch(params);

    expect(result.topResults.map((r) => r.businessName)).toEqual(["Own Co", "B Shop"]);
    expect(result.topResults[1]).toMatchObject({ domain: "bshop.com", rating: 4.5, reviewsCount: 10, category: "Chocolate shop" });
    expect(result.ownDomainPosition).toBe(1);
  });

  it("returns a null position when the client's domain isn't in the results", async () => {
    stubFetch([{ rank: 1, title: "Someone Else", website: "https://else.com" }]);
    expect((await runCompetitorSearch(params)).ownDomainPosition).toBeNull();
  });

  it("returns a null position when the client has no website connected", async () => {
    stubFetch([{ rank: 1, title: "Own Co", website: "https://owncompany.com" }]);
    expect((await runCompetitorSearch({ ...params, ownDomain: null })).ownDomainPosition).toBeNull();
  });

  it("turns a 401 into a clear invalid-token error", async () => {
    stubFetch({}, 401);
    await expect(runCompetitorSearch(params)).rejects.toThrow("Apify API token is invalid or expired.");
  });

  it("surfaces Apify's own error message (e.g. out of credits) as an ApifyError", async () => {
    stubFetch({ error: { message: "Not enough credits" } }, 402);
    const err = await runCompetitorSearch(params).catch((e) => e);
    expect(err).toBeInstanceOf(ApifyError);
    expect(err.message).toBe("Not enough credits");
  });
});
