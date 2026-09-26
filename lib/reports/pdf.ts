import satori from "satori";
import sharp from "sharp";
import type { ReactNode } from "react";
import { PDFDocument } from "pdf-lib";
import { box, fonts, image, label, type Child, type El } from "@/lib/creative/render";
import { brandPalette, shade } from "@/lib/creative/spec";
import type { ReportMetricsInput } from "@/lib/ai/generate-report";
import {
  changeLabel,
  formatCount,
  formatDate,
  formatPeriod,
  periodDays,
  pointsChange,
  positionChange,
  type Change,
} from "@/lib/reports/format";
import { fitParagraphs } from "@/lib/reports/layout";

// The downloadable report. Each page is drawn the way post graphics are (satori
// lays it out, with proper Hindi shaping, and sharp makes a JPEG) and the pages
// are then placed on A4 sheets in a PDF. Only figures already in the report are
// shown, and a source that isn't connected says so instead of showing a zero.

export interface ReportPdfData {
  businessName: string;
  logoDataUrl: string | null;
  colors: string[] | null;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  summary: string | null;
  nextPlan: string | null;
  metrics: ReportMetricsInput;
}

// A4 at 150 dpi, and the same sheet in PDF points (1/72 inch).
export const PAGE_W = 1240;
export const PAGE_H = 1754;
const A4_W_PT = 595.28;
const A4_H_PT = 841.89;
const PAD = 72;
const CONTENT_W = PAGE_W - PAD * 2;

const INK = "#111827";
const INK_SOFT = "#4b5563";
const INK_FAINT = "#6b7280";
const RULE = "#e5e7eb";
const TONE_COLOR: Record<Change["tone"], string> = { good: "#0f7b55", bad: "#b42318", flat: "#6b7280" };

const TOTAL_PAGES = 2;

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function footer(page: number): El {
  return box(
    { position: "absolute", left: PAD, right: PAD, bottom: 44, justifyContent: "space-between", alignItems: "center", borderTop: `2px solid ${RULE}`, paddingTop: 20 },
    label({ fontSize: 20, color: INK_FAINT }, "Prepared by Digital Command"),
    label({ fontSize: 20, color: INK_FAINT }, `Page ${page} of ${TOTAL_PAGES}`)
  );
}

function sectionTitle(text: string, accent: string): El {
  return box(
    { alignItems: "center", marginBottom: 20 },
    box({ width: 10, height: 38, borderRadius: 5, background: accent, marginRight: 18 }),
    label({ fontSize: 38, fontWeight: 700, color: INK }, text)
  );
}

interface Tile {
  title: string;
  // null = this source isn't connected / hasn't been run
  value: string | null;
  change: Change | null;
  note: string;
  missing: string;
}

function bigTile(tile: Tile, tint: string, accent: string): El {
  const has = tile.value !== null;
  return box(
    {
      width: (CONTENT_W - 32) / 2,
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: 250,
      padding: 30,
      borderRadius: 24,
      background: tint,
      border: `2px solid ${RULE}`,
    },
    box(
      { flexDirection: "column" },
      label({ fontSize: 22, fontWeight: 700, color: INK_SOFT, letterSpacing: 1 }, tile.title.toUpperCase()),
      has
        ? label({ fontSize: 74, fontWeight: 700, color: INK, marginTop: 8, lineHeight: 1.1 }, tile.value as string)
        : label({ fontSize: 34, fontWeight: 700, color: INK_FAINT, marginTop: 14, lineHeight: 1.2 }, "Not connected yet")
    ),
    box(
      { flexDirection: "column", marginTop: 14 },
      has
        ? tile.change
          ? label({ fontSize: 26, fontWeight: 700, color: TONE_COLOR[tile.change.tone] }, `${tile.change.text} since the last report`)
          : label({ fontSize: 22, color: INK_FAINT }, "First reading — no earlier report")
        : label({ fontSize: 22, color: INK_FAINT }, tile.missing),
      has ? label({ fontSize: 20, color: INK_FAINT, marginTop: 6 }, tile.note) : null
    ),
    // a thin accent line so the four tiles read as a set
    box({ position: "absolute", left: 30, top: 0, width: 64, height: 6, borderRadius: 3, background: accent })
  );
}

function smallStat(title: string, value: string | null): El {
  return box(
    { flexDirection: "column", flex: 1, padding: "22px 24px", borderRadius: 20, border: `2px solid ${RULE}` },
    label({ fontSize: 34, fontWeight: 700, color: value === null ? "#9ca3af" : INK }, value ?? "—"),
    label({ fontSize: 19, color: INK_SOFT, marginTop: 6 }, title)
  );
}

function statRow(...stats: El[]): El {
  return box({ width: CONTENT_W, gap: 20 }, ...stats);
}

function paragraphs(items: string[], size: number): El {
  return box(
    { flexDirection: "column" },
    ...items.map((text, i) =>
      label({ fontSize: size, lineHeight: 1.55, color: "#1f2937", marginTop: i === 0 ? 0 : Math.round(size * 0.55) }, text)
    )
  );
}

// ---------------------------------------------------------------------------
// Page 1 — the numbers
// ---------------------------------------------------------------------------

export function buildResultsPage(data: ReportPdfData): El {
  const p = brandPalette(data.colors);
  const tint = shade(p.primary, 0.94);
  const { metrics } = data;
  const days = periodDays(data.periodStart, data.periodEnd);

  const seo = metrics.seoAudit;
  const sc = metrics.searchConsole;
  const ga = metrics.analytics;

  const tiles: Tile[] = [
    {
      title: "SEO health score",
      value: seo ? `${Math.round(Number(seo.score))}/100` : null,
      change: seo ? pointsChange(Number(seo.score), seo.previousScore === null ? null : Number(seo.previousScore)) : null,
      note: seo ? `${seo.issueCount} ${seo.issueCount === 1 ? "issue" : "issues"} found on your website` : "",
      missing: "Run an SEO audit to see this.",
    },
    {
      title: "Clicks from Google",
      value: sc ? formatCount(Number(sc.clicks)) : null,
      change: sc ? changeLabel(Number(sc.clicks), sc.previousClicks === null ? null : Number(sc.previousClicks)) : null,
      note: "People who clicked through to your website",
      missing: "Connect Google Search Console to see this.",
    },
    {
      title: "Average position on Google",
      value: sc ? Number(sc.avgPosition).toFixed(1) : null,
      change: sc ? positionChange(Number(sc.avgPosition), sc.previousAvgPosition === null ? null : Number(sc.previousAvgPosition)) : null,
      note: "A smaller number means higher up the results",
      missing: "Connect Google Search Console to see this.",
    },
    {
      title: "Website visits",
      value: ga ? formatCount(Number(ga.sessions)) : null,
      change: ga ? changeLabel(Number(ga.sessions), ga.previousSessions === null ? null : Number(ga.previousSessions)) : null,
      note: "Visits to your website, from Google Analytics",
      missing: "Connect Google Analytics to see this.",
    },
  ];

  return box(
    { position: "relative", width: PAGE_W, height: PAGE_H, flexDirection: "column", fontFamily: "Poppins", background: "#ffffff" },

    // header band
    box(
      { flexDirection: "column", backgroundImage: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, padding: `64px ${PAD}px 56px` },
      box(
        { alignItems: "center" },
        data.logoDataUrl
          ? box({ background: "#ffffff", borderRadius: 22, padding: 10, marginRight: 26 }, image(data.logoDataUrl, { width: 84, height: 84, objectFit: "contain" }))
          : box({ width: 14, height: 84, borderRadius: 7, background: p.accent, marginRight: 26 }),
        box(
          { flexDirection: "column" },
          label({ fontSize: 22, fontWeight: 700, color: p.onPrimary, letterSpacing: 5, opacity: 0.85 }, "MARKETING REPORT"),
          // extra line height: Devanagari letters and their top bars stand taller than Latin
          label({ fontSize: 50, fontWeight: 700, color: p.onPrimary, marginTop: 10, lineHeight: 1.3, maxWidth: 900 }, data.businessName)
        )
      ),
      box(
        { alignItems: "center", marginTop: 38 },
        label({ fontSize: 34, fontWeight: 700, color: p.onPrimary }, formatPeriod(data.periodStart, data.periodEnd)),
        days
          ? box(
              { marginLeft: 22, padding: "6px 20px", borderRadius: 999, background: "rgba(255,255,255,0.18)" },
              label({ fontSize: 22, fontWeight: 700, color: p.onPrimary }, `${days} days`)
            )
          : null
      )
    ),

    // body
    box(
      { flexDirection: "column", padding: `52px ${PAD}px 0` },
      sectionTitle("Results at a glance", p.primary),
      box({ flexWrap: "wrap", gap: 32 }, ...tiles.map((t, i) => bigTile(t, tint, i % 2 === 0 ? p.primary : p.accent))),

      box({ marginTop: 40 }, label({ fontSize: 26, fontWeight: 700, color: INK }, "More detail")),
      box(
        { marginTop: 16 },
        statRow(
          smallStat("Search impressions", sc ? formatCount(Number(sc.impressions)) : null),
          smallStat("Click-through rate", sc ? `${(Number(sc.avgCtr) * 100).toFixed(1)}%` : null),
          smallStat("Website visitors", ga ? formatCount(Number(ga.users)) : null),
          smallStat("Conversions recorded", ga ? formatCount(Number(ga.conversions)) : null)
        )
      ),

      box({ marginTop: 40 }, label({ fontSize: 26, fontWeight: 700, color: INK }, "Social posts this period")),
      box(
        { marginTop: 16 },
        statRow(
          smallStat("Posts planned", formatCount(metrics.content.totalCount)),
          smallStat("Scheduled", formatCount(metrics.content.scheduledCount)),
          smallStat("Published", formatCount(metrics.content.publishedCount))
        )
      )
    ),

    footer(1)
  );
}

// ---------------------------------------------------------------------------
// Page 2 — the work and the plan
// ---------------------------------------------------------------------------

export function buildWorkPage(data: ReportPdfData): El {
  const p = brandPalette(data.colors);

  // Room left for the two written sections after the header, titles, the note and the footer.
  const TEXT_HEIGHT = 470;
  const summary = fitParagraphs(data.summary, CONTENT_W, TEXT_HEIGHT);
  const plan = fitParagraphs(data.nextPlan, CONTENT_W, TEXT_HEIGHT);

  const section = (title: string, text: ReturnType<typeof fitParagraphs>, empty: string): Child =>
    box(
      { flexDirection: "column", marginBottom: 44 },
      sectionTitle(title, p.primary),
      text.paragraphs.length > 0 ? paragraphs(text.paragraphs, text.size) : label({ fontSize: 24, color: INK_FAINT }, empty)
    );

  return box(
    { position: "relative", width: PAGE_W, height: PAGE_H, flexDirection: "column", fontFamily: "Poppins", background: "#ffffff" },

    box(
      { justifyContent: "space-between", alignItems: "center", backgroundImage: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)`, padding: `40px ${PAD}px` },
      label({ fontSize: 32, fontWeight: 700, color: p.onPrimary, maxWidth: 700 }, data.businessName),
      label({ fontSize: 24, fontWeight: 700, color: p.onPrimary }, formatPeriod(data.periodStart, data.periodEnd))
    ),

    box(
      { flexDirection: "column", padding: `56px ${PAD}px 0` },
      section("Work completed", summary, "No summary was written for this report."),
      data.nextPlan && plan.paragraphs.length > 0 ? section("Plan for the next period", plan, "") : null
    ),

    // pinned above the footer; the written sections above are sized to leave room for it
    box(
      { position: "absolute", left: PAD, right: PAD, bottom: 130 },
      box(
        { flexDirection: "column", width: CONTENT_W, padding: "26px 30px", borderRadius: 20, background: shade(p.primary, 0.94), border: `2px solid ${RULE}` },
        label({ fontSize: 22, fontWeight: 700, color: INK }, "About these numbers"),
        label(
          { fontSize: 20, lineHeight: 1.5, color: INK_SOFT, marginTop: 8 },
          "Figures come from Google Search Console, Google Analytics, your SEO audit and Digital Command's own records for the period shown. Search positions and website traffic change from day to day, and this report does not promise any particular result."
        ),
        label({ fontSize: 19, color: INK_FAINT, marginTop: 12 }, `Report created on ${formatDate(data.generatedAt)}.`)
      )
    ),

    footer(2)
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

async function renderPage(element: El): Promise<Uint8Array> {
  const svg = await satori(element as unknown as ReactNode, { width: PAGE_W, height: PAGE_H, fonts: fonts() });
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
  return new Uint8Array(jpeg);
}

export async function renderReportPages(data: ReportPdfData): Promise<Uint8Array[]> {
  return Promise.all([renderPage(buildResultsPage(data)), renderPage(buildWorkPage(data))]);
}

export async function assembleReportPdf(pages: Uint8Array[], data: ReportPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${data.businessName} — marketing report, ${formatPeriod(data.periodStart, data.periodEnd)}`);
  pdf.setAuthor("Digital Command");
  pdf.setCreator("Digital Command");
  pdf.setProducer("Digital Command");
  const created = new Date(data.generatedAt);
  if (!Number.isNaN(created.getTime())) {
    pdf.setCreationDate(created);
    pdf.setModificationDate(created);
  }

  for (const bytes of pages) {
    const jpg = await pdf.embedJpg(bytes);
    const page = pdf.addPage([A4_W_PT, A4_H_PT]);
    page.drawImage(jpg, { x: 0, y: 0, width: A4_W_PT, height: A4_H_PT });
  }
  return pdf.save();
}

export async function renderReportPdf(data: ReportPdfData): Promise<Uint8Array> {
  return assembleReportPdf(await renderReportPages(data), data);
}
