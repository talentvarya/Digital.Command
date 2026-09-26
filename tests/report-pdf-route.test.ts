import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

// A stand-in for the signed-in member's Supabase session. It answers each table
// from `data` and remembers every filter used, so the tests can check that the
// route only ever asks for the member's own business.
interface Call {
  table: string;
  filters: [string, unknown][];
}
let user: { id: string } | null;
let data: Record<string, unknown>;
let calls: Call[];

function chain(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      call.filters.push([column, value]);
      return api;
    },
    maybeSingle: async () => ({ data: data[table] ?? null }),
  };
  return api;
}

const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: (table: string) => chain(table),
  storage: { from: () => ({ download: async () => ({ data: null }) }) },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: () => fakeSupabase }));

// The real drawing code, unless a test switches on a failure.
let failDrawing = false;
vi.mock("@/lib/reports/pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reports/pdf")>();
  return {
    ...actual,
    renderReportPdf: (data: Parameters<typeof actual.renderReportPdf>[0]) =>
      failDrawing ? Promise.reject(new Error("could not draw")) : actual.renderReportPdf(data),
  };
});

import { GET } from "@/app/app/reports/[id]/pdf/route";

const REPORT_ID = "0b6d2c58-7e1a-4c65-9f0e-3a4d6f1b2c90";

const report = {
  id: REPORT_ID,
  period_start: "2026-08-26",
  period_end: "2026-09-25",
  generated_at: "2026-09-26T09:30:00.000Z",
  summary_text: "Your website scored 72 out of 100.",
  next_plan_text: "Keep posting daily.",
  metrics_snapshot: {
    seoAudit: { score: 72, issueCount: 3, previousScore: 67 },
    searchConsole: null,
    analytics: null,
    content: { totalCount: 4, scheduledCount: 2, publishedCount: 1 },
  },
};

const ask = (id: string) => GET(new Request(`http://localhost/app/reports/${id}/pdf`), { params: { id } });

beforeEach(() => {
  user = { id: "user-1" };
  calls = [];
  data = {
    organization_members: { org_id: "org-1" },
    reports: report,
    organizations: { legal_name: "Aura Lux Chocolate Co." },
    brand_profiles: { logo_path: null, colors: ["#5b2a86", "#f2b705"] },
  };
});

describe("GET /app/reports/[id]/pdf", () => {
  it("returns the report as a downloadable PDF", async () => {
    const res = await ask(REPORT_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Aura-Lux-Chocolate-Co-marketing-report-2026-08-26-to-2026-09-25.pdf"'
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");

    const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toContain("Aura Lux Chocolate Co.");
  }, 60_000);

  it("only ever looks up the member's own business's report", async () => {
    await ask(REPORT_ID);
    const reportLookup = calls.find((c) => c.table === "reports");
    expect(reportLookup?.filters).toEqual([
      ["id", REPORT_ID],
      ["org_id", "org-1"],
    ]);
    expect(calls.find((c) => c.table === "brand_profiles")?.filters).toEqual([["org_id", "org-1"]]);
  }, 60_000);

  it("says not found when the report isn't the member's (or doesn't exist)", async () => {
    data.reports = null;
    const res = await ask(REPORT_ID);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("refuses when nobody is signed in, without reading any report", async () => {
    user = null;
    const res = await ask(REPORT_ID);
    expect(res.status).toBe(401);
    expect(calls.some((c) => c.table === "reports")).toBe(false);
  });

  it("says not found for an id that isn't a valid id, without touching the database", async () => {
    for (const id of ["abc", "../../etc/passwd", "0b6d2c58-7e1a-4c65-9f0e-3a4d6f1b2c9", `${REPORT_ID}'; drop table reports;--`]) {
      const res = await ask(id);
      expect(res.status).toBe(404);
    }
    expect(calls).toHaveLength(0);
  });

  it("still makes a PDF when the saved figures and text are unreadable or missing", async () => {
    data.reports = { ...report, metrics_snapshot: "not an object", summary_text: null, next_plan_text: null };
    const res = await ask(REPORT_ID);
    expect(res.status).toBe(200);
    expect((await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))).getPageCount()).toBe(2);
  }, 60_000);

  it("tells the member to try again if the PDF can't be drawn, without exposing the error", async () => {
    failDrawing = true;
    try {
      const res = await ask(REPORT_ID);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("The PDF could not be made — please try again.");
    } finally {
      failDrawing = false;
    }
  });
});
