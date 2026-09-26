import { describe, expect, it } from "vitest";
import { normalizeMetrics } from "@/lib/reports/pdf-data";
import { countIssues } from "@/lib/ai/generate-report";

const P = ["2026-08-26", "2026-09-25"] as const;

describe("countIssues", () => {
  it("counts the issues an SEO audit found — the report used to say 0 whatever the audit found", () => {
    expect(countIssues([{ severity: "critical" }, { severity: "warning" }, { severity: "info" }])).toBe(3);
    expect(countIssues([])).toBe(0);
  });

  it("treats anything that isn't a list as no issues recorded", () => {
    for (const junk of [null, undefined, "3", 3, {}]) expect(countIssues(junk)).toBe(0);
  });
});

describe("normalizeMetrics", () => {
  it("passes a well-formed snapshot through unchanged", () => {
    const raw = {
      seoAudit: { score: 72, issueCount: 3, previousScore: 67 },
      searchConsole: { clicks: 1240, impressions: 48210, avgPosition: 12.3, avgCtr: 0.0257, previousClicks: 1010, previousAvgPosition: 14.1 },
      analytics: { sessions: 3905, users: 3120, conversions: 41, previousSessions: 4200 },
      content: { totalCount: 18, scheduledCount: 12, publishedCount: 6 },
    };
    expect(normalizeMetrics(raw, ...P)).toEqual({ periodStart: P[0], periodEnd: P[1], ...raw });
  });

  it("reads numbers that arrived as text", () => {
    const out = normalizeMetrics({ searchConsole: { clicks: "1240", impressions: "48210", avgPosition: "12.30", avgCtr: "0.0257" } }, ...P);
    expect(out.searchConsole).toMatchObject({ clicks: 1240, impressions: 48210, avgPosition: 12.3, avgCtr: 0.0257, previousClicks: null });
  });

  it("treats a source with no main figure as not connected", () => {
    const out = normalizeMetrics({ seoAudit: {}, searchConsole: { impressions: 5 }, analytics: { users: 4 } }, ...P);
    expect([out.seoAudit, out.searchConsole, out.analytics]).toEqual([null, null, null]);
  });

  it("does not turn a missing earlier figure into a zero", () => {
    const out = normalizeMetrics({ seoAudit: { score: 58, issueCount: 1 }, analytics: { sessions: 10 } }, ...P);
    expect(out.seoAudit?.previousScore).toBeNull();
    expect(out.analytics?.previousSessions).toBeNull();
  });

  it("survives junk in the column", () => {
    for (const junk of [null, undefined, 42, "text", [], { seoAudit: "x", searchConsole: [], analytics: 3, content: "nope" }]) {
      const out = normalizeMetrics(junk, ...P);
      expect(out.seoAudit).toBeNull();
      expect(out.searchConsole).toBeNull();
      expect(out.analytics).toBeNull();
      expect(out.content).toEqual({ totalCount: 0, scheduledCount: 0, publishedCount: 0 });
    }
  });

  it("ignores NaN and Infinity", () => {
    const out = normalizeMetrics({ seoAudit: { score: Number.NaN }, analytics: { sessions: Infinity } }, ...P);
    expect(out.seoAudit).toBeNull();
    expect(out.analytics).toBeNull();
  });
});
