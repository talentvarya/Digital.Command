import type { ReportMetricsInput } from "@/lib/ai/generate-report";

// A saved report's figures live in a JSON column. This reads them defensively so
// one odd or older row can never crash the download: a source that isn't a proper
// object counts as "not connected", and a number that isn't a number is ignored.

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

// Postgres numerics sometimes arrive as strings ("12.30"), so those are accepted too.
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeMetrics(raw: unknown, periodStart: string, periodEnd: string): ReportMetricsInput {
  const m: Rec = isRec(raw) ? raw : {};

  const seo = isRec(m.seoAudit) ? m.seoAudit : null;
  const sc = isRec(m.searchConsole) ? m.searchConsole : null;
  const ga = isRec(m.analytics) ? m.analytics : null;
  const content: Rec = isRec(m.content) ? m.content : {};

  const seoScore = seo ? num(seo.score) : null;
  const clicks = sc ? num(sc.clicks) : null;
  const sessions = ga ? num(ga.sessions) : null;

  return {
    periodStart,
    periodEnd,
    // A source without its main figure is treated as not connected.
    seoAudit:
      seo && seoScore !== null
        ? { score: seoScore, issueCount: num(seo.issueCount) ?? 0, previousScore: num(seo.previousScore) }
        : null,
    searchConsole:
      sc && clicks !== null
        ? {
            clicks,
            impressions: num(sc.impressions) ?? 0,
            avgPosition: num(sc.avgPosition) ?? 0,
            avgCtr: num(sc.avgCtr) ?? 0,
            previousClicks: num(sc.previousClicks),
            previousAvgPosition: num(sc.previousAvgPosition),
          }
        : null,
    analytics:
      ga && sessions !== null
        ? { sessions, users: num(ga.users) ?? 0, conversions: num(ga.conversions) ?? 0, previousSessions: num(ga.previousSessions) }
        : null,
    content: {
      totalCount: num(content.totalCount) ?? 0,
      scheduledCount: num(content.scheduledCount) ?? 0,
      publishedCount: num(content.publishedCount) ?? 0,
    },
  };
}
