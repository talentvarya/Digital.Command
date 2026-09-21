import { describe, expect, it } from "vitest";
import { computeVisibility } from "@/lib/visibility/score";
import { getNapFields } from "@/lib/visibility/nap";

describe("computeVisibility", () => {
  it("averages the components that have been measured", () => {
    const v = computeVisibility({ seoScore: 80, aeoScore: 40, napFilled: 4, napTotal: 4, citationsDone: 2, citationsTotal: 8 });
    expect(v.components.map((c) => c.value)).toEqual([80, 40, 100, 25]);
    expect(v.overall).toBe(61); // (80+40+100+25)/4 = 61.25
    expect(v.measured).toBe(4);
  });

  it("does not count an unmeasured audit as zero", () => {
    const v = computeVisibility({ seoScore: null, aeoScore: null, napFilled: 2, napTotal: 4, citationsDone: 4, citationsTotal: 8 });
    expect(v.components.find((c) => c.key === "seo")?.value).toBeNull();
    expect(v.overall).toBe(50); // only NAP 50 and citations 50
    expect(v.measured).toBe(2);
  });

  it("has no overall figure when nothing can be measured", () => {
    const v = computeVisibility({ seoScore: null, aeoScore: null, napFilled: 0, napTotal: 0, citationsDone: 0, citationsTotal: 0 });
    expect(v.overall).toBeNull();
    expect(v.measured).toBe(0);
  });

  it("keeps audit scores inside 0-100", () => {
    const v = computeVisibility({ seoScore: 140, aeoScore: -5, napFilled: 0, napTotal: 4, citationsDone: 0, citationsTotal: 8 });
    expect(v.components.map((c) => c.value)).toEqual([100, 0, 0, 0]);
  });

  it("links each component to the module that improves it", () => {
    const v = computeVisibility({ seoScore: 1, aeoScore: 1, napFilled: 1, napTotal: 4, citationsDone: 1, citationsTotal: 8 });
    expect(v.components.map((c) => c.href)).toEqual(["/app/seo", "/app/ai-visibility", "/app/local-seo", "/app/local-seo"]);
  });
});

describe("getNapFields", () => {
  it("marks each essential filled only when it actually has content", () => {
    const fields = getNapFields({
      local: { address: "Shop 12", city: "Pune", state: "  ", pincode: "411004", gbp_url: "" },
      brand: { phone: null, whatsapp: "+91 98765 43210" },
    });
    expect(fields.map((f) => f.filled)).toEqual([true, false, true, false]);
  });

  it("treats a missing profile as everything unfilled", () => {
    expect(getNapFields({ local: null, brand: null }).every((f) => !f.filled)).toBe(true);
  });
});
