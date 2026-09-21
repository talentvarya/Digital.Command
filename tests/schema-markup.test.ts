import { describe, expect, it } from "vitest";
import { buildFaqPageJsonLd, buildLocalBusinessJsonLd, parseFaqPairs, toScriptTag } from "@/lib/aeo/schema-markup";

describe("buildLocalBusinessJsonLd", () => {
  it("builds a full LocalBusiness from complete data", () => {
    const { json, missing } = buildLocalBusinessJsonLd({
      name: " Aura Lux Chocolate Co. ",
      description: "Handcrafted chocolates.",
      websiteUrl: "https://auralux.example",
      phone: "+91 98765 43210",
      streetAddress: "Shop 12, FC Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411004",
      sameAs: ["https://facebook.com/auralux", " "],
    });
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Aura Lux Chocolate Co.",
      description: "Handcrafted chocolates.",
      url: "https://auralux.example",
      telephone: "+91 98765 43210",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Shop 12, FC Road",
        addressLocality: "Pune",
        addressRegion: "Maharashtra",
        postalCode: "411004",
      },
      sameAs: ["https://facebook.com/auralux"],
    });
    expect(missing).toEqual([]);
  });

  it("omits what it wasn't given instead of inventing it, and says what's missing", () => {
    const { json, missing } = buildLocalBusinessJsonLd({ name: "Aura Lux", phone: "  ", city: "Pune" });
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Aura Lux",
      address: { "@type": "PostalAddress", addressLocality: "Pune" },
    });
    expect(JSON.stringify(json)).not.toContain("addressCountry");
    expect(missing).toEqual(["business description", "website", "phone", "social/profile links"]);
  });

  it("leaves out the address block entirely when there is no address data", () => {
    const { json, missing } = buildLocalBusinessJsonLd({ name: "Aura Lux" });
    expect(json).not.toHaveProperty("address");
    expect(missing).toContain("address");
  });
});

describe("parseFaqPairs / buildFaqPageJsonLd", () => {
  const TEXT = "Q: Where are you?\nA: Pune.\n\nQ: What do you sell?\nA: Chocolates, and hampers.\n\nnot a pair at all";

  it("parses Q:/A: blocks and skips blocks that don't fit", () => {
    expect(parseFaqPairs(TEXT)).toEqual([
      { question: "Where are you?", answer: "Pune." },
      { question: "What do you sell?", answer: "Chocolates, and hampers." },
    ]);
  });

  it("returns nothing for empty or unparseable text", () => {
    expect(parseFaqPairs("")).toEqual([]);
    expect(parseFaqPairs("just some prose")).toEqual([]);
  });

  it("builds a valid FAQPage, or null when there are no pairs", () => {
    expect(buildFaqPageJsonLd([])).toBeNull();
    expect(buildFaqPageJsonLd(parseFaqPairs(TEXT))).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "Where are you?", acceptedAnswer: { "@type": "Answer", text: "Pune." } },
        { "@type": "Question", name: "What do you sell?", acceptedAnswer: { "@type": "Answer", text: "Chocolates, and hampers." } },
      ],
    });
  });
});

describe("toScriptTag", () => {
  it("wraps JSON in a ld+json script tag", () => {
    const tag = toScriptTag({ a: 1 });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });

  it("can't be broken out of by client text containing </script>", () => {
    const tag = toScriptTag({ name: "x</script><script>alert(1)</script>" });
    const inner = tag.slice(tag.indexOf("\n") + 1, tag.lastIndexOf("\n"));
    expect(inner).not.toContain("<");
    expect(JSON.parse(inner).name).toBe("x</script><script>alert(1)</script>");
  });
});
