import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildResultsPage, buildWorkPage, renderReportPdf, type ReportPdfData } from "@/lib/reports/pdf";
import { fitParagraphs, splitParagraphs } from "@/lib/reports/layout";
import type { El } from "@/lib/creative/render";

// Every piece of text drawn on a page, in order — what a reader would see.
function textOf(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (node && typeof node === "object" && "props" in node) return textOf((node as El).props.children);
  return [];
}

const full: ReportPdfData = {
  businessName: "Aura Lux Chocolate Co.",
  logoDataUrl: null,
  colors: ["#5b2a86", "#f2b705"],
  periodStart: "2026-08-26",
  periodEnd: "2026-09-25",
  generatedAt: "2026-09-26T09:30:00.000Z",
  summary: "Your website scored 72 out of 100.\n\nआपके चॉकलेट गिफ्ट बॉक्स वाले पोस्ट पर सबसे ज़्यादा लोगों ने क्लिक किया।",
  nextPlan: "Keep posting daily and fix the three website issues.",
  metrics: {
    periodStart: "2026-08-26",
    periodEnd: "2026-09-25",
    seoAudit: { score: 72, issueCount: 3, previousScore: 67 },
    searchConsole: { clicks: 1240, impressions: 48210, avgPosition: 12.3, avgCtr: 0.0257, previousClicks: 1010, previousAvgPosition: 14.1 },
    analytics: { sessions: 3905, users: 3120, conversions: 41, previousSessions: 4200 },
    content: { totalCount: 18, scheduledCount: 12, publishedCount: 6 },
  },
};

const noSources: ReportPdfData = {
  ...full,
  metrics: { ...full.metrics, seoAudit: null, searchConsole: null, analytics: null },
};

describe("results page", () => {
  const text = textOf(buildResultsPage(full)).join(" | ");

  it("names the business and the period", () => {
    expect(text).toContain("Aura Lux Chocolate Co.");
    expect(text).toContain("26 Aug – 25 Sep 2026");
    expect(text).toContain("30 days");
  });

  it("shows the real figures with how each moved", () => {
    expect(text).toContain("72/100");
    expect(text).toContain("+5 points since the last report");
    expect(text).toContain("3 issues found on your website");
    expect(text).toContain("1,240");
    expect(text).toContain("+23% since the last report");
    expect(text).toContain("12.3");
    expect(text).toContain("Up 1.8 places since the last report");
    expect(text).toContain("3,905");
    expect(text).toContain("-7.0% since the last report");
  });

  it("shows the secondary numbers and the post counts", () => {
    for (const expected of ["48,210", "2.6%", "3,120", "41", "18", "12", "6"]) expect(text).toContain(expected);
  });

  it("says a source isn't connected rather than showing zeros", () => {
    const bare = textOf(buildResultsPage(noSources)).join(" | ");
    expect(bare.match(/Not connected yet/g)).toHaveLength(4);
    expect(bare).toContain("Run an SEO audit to see this.");
    expect(bare).toContain("Connect Google Search Console to see this.");
    expect(bare).toContain("Connect Google Analytics to see this.");
    expect(bare).not.toMatch(/0\/100|1,240|3,905/);
    // the secondary numbers show a dash, not 0
    expect(bare).toContain("—");
  });

  it("says when there is no earlier report to compare with", () => {
    const first = buildResultsPage({
      ...full,
      metrics: { ...full.metrics, seoAudit: { score: 58, issueCount: 1, previousScore: null } },
    });
    const firstText = textOf(first).join(" | ");
    expect(firstText).toContain("58/100");
    expect(firstText).toContain("First reading — no earlier report");
    expect(firstText).toContain("1 issue found on your website");
  });
});

describe("work page", () => {
  it("carries both written sections and the honesty note", () => {
    const text = textOf(buildWorkPage(full)).join(" | ");
    expect(text).toContain("Work completed");
    expect(text).toContain("Your website scored 72 out of 100.");
    expect(text).toContain("आपके चॉकलेट गिफ्ट बॉक्स");
    expect(text).toContain("Plan for the next period");
    expect(text).toContain("does not promise any particular result");
  });

  it("leaves out the plan section when there is no plan", () => {
    const text = textOf(buildWorkPage({ ...full, nextPlan: "" })).join(" | ");
    expect(text).not.toContain("Plan for the next period");
  });

  it("says so when no summary was written", () => {
    expect(textOf(buildWorkPage({ ...full, summary: null })).join(" | ")).toContain("No summary was written for this report.");
  });
});

describe("the PDF", () => {
  it("is a two-page A4 document with the report's details", async () => {
    const bytes = await renderReportPdf(full);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      expect(width).toBeCloseTo(595.28, 1);
      expect(height).toBeCloseTo(841.89, 1);
    }
    expect(doc.getTitle()).toContain("Aura Lux Chocolate Co.");
    expect(doc.getTitle()).toContain("26 Aug – 25 Sep 2026");
    expect(doc.getAuthor()).toBe("Digital Command");
  }, 60_000);

  it("still makes a report when nothing is connected, and when the text is very long", async () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i + 1} describes some of the work that was completed this month.`).join(" ");
    const bytes = await renderReportPdf({ ...noSources, summary: long, nextPlan: long });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  }, 60_000);
});

describe("fitting written text to the page", () => {
  it("splits on line breaks and tidies spacing", () => {
    expect(splitParagraphs("  One   two \n\n\nThree\r\nFour ")).toEqual(["One two", "Three", "Four"]);
    expect(splitParagraphs(null)).toEqual([]);
    expect(splitParagraphs("   ")).toEqual([]);
  });

  it("uses the biggest size when the text is short", () => {
    const fit = fitParagraphs("A short paragraph.", 1096, 470);
    expect(fit.size).toBe(28);
    expect(fit.truncated).toBe(false);
    expect(fit.paragraphs).toEqual(["A short paragraph."]);
  });

  it("shrinks the type for a longer text so it still fits", () => {
    const text = Array.from({ length: 22 }, (_, i) => `Sentence ${i + 1} about the work that was done this month.`).join(" ");
    const fit = fitParagraphs(text, 1096, 470);
    expect(fit.size).toBeLessThan(28);
    expect(fit.size).toBeGreaterThanOrEqual(20);
    expect(fit.truncated).toBe(false);
  });

  it("shortens a text that cannot fit even at the smallest size, and says so", () => {
    const text = Array.from({ length: 300 }, (_, i) => `Sentence ${i + 1} about the work that was done this month.`).join(" ");
    const fit = fitParagraphs(text, 1096, 470);
    expect(fit.size).toBe(20);
    expect(fit.truncated).toBe(true);
    const shown = fit.paragraphs.join(" ");
    expect(shown.length).toBeLessThan(text.length);
    expect(shown.endsWith("…")).toBe(true);
  });

  it("keeps whole paragraphs when cutting, and drops the rest", () => {
    const paragraph = Array.from({ length: 40 }, (_, i) => `Point ${i + 1} of the plan.`).join(" ");
    const fit = fitParagraphs([paragraph, paragraph, paragraph, paragraph, paragraph, paragraph].join("\n"), 1096, 470);
    expect(fit.truncated).toBe(true);
    expect(fit.paragraphs.length).toBeLessThan(6);
    expect(fit.paragraphs.length).toBeGreaterThan(0);
  });

  it("returns nothing to draw for empty text", () => {
    expect(fitParagraphs("", 1096, 470)).toEqual({ size: 28, paragraphs: [], truncated: false });
  });
});
