import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMember } from "@/lib/auth/require-org-member";
import { cleanOverlayText, toDataUrl } from "@/lib/creative/spec";
import { normalizeMetrics } from "@/lib/reports/pdf-data";
import { renderReportPdf } from "@/lib/reports/pdf";
import { reportFileName } from "@/lib/reports/format";

// Drawing the pages and putting them into a PDF takes a couple of seconds.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function plain(status: number, message: string) {
  return new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

// The client's own report as a branded PDF they can save or forward. Row-level
// security limits every read to the signed-in member's own business; the org
// filter below repeats that on purpose.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return plain(404, "Report not found.");

  const supabase = createClient();
  const member = await requireOrgMember(supabase);
  if ("error" in member) return plain(401, member.error);

  const { data: report } = await supabase
    .from("reports")
    .select("id, period_start, period_end, generated_at, metrics_snapshot, summary_text, next_plan_text")
    .eq("id", params.id)
    .eq("org_id", member.orgId)
    .maybeSingle();
  if (!report) return plain(404, "Report not found.");

  const [{ data: org }, { data: brand }] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", member.orgId).maybeSingle(),
    supabase.from("brand_profiles").select("logo_path, colors").eq("org_id", member.orgId).maybeSingle(),
  ]);

  // A missing or unreadable logo file just means the report has no logo.
  let logoDataUrl: string | null = null;
  if (brand?.logo_path) {
    try {
      const { data: file } = await supabase.storage.from("brand-assets").download(brand.logo_path);
      if (file) logoDataUrl = toDataUrl(new Uint8Array(await file.arrayBuffer()));
    } catch {
      logoDataUrl = null;
    }
  }

  const businessName = cleanOverlayText(org?.legal_name ?? "").slice(0, 60) || "Your business";

  let pdf: Uint8Array;
  try {
    pdf = await renderReportPdf({
      businessName,
      logoDataUrl,
      colors: Array.isArray(brand?.colors) ? (brand?.colors as string[]) : null,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      generatedAt: report.generated_at,
      summary: report.summary_text,
      nextPlan: report.next_plan_text,
      metrics: normalizeMetrics(report.metrics_snapshot, report.period_start, report.period_end),
    });
  } catch (err) {
    console.error("Report PDF failed:", err);
    return plain(500, "The PDF could not be made — please try again.");
  }

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFileName(businessName, report.period_start, report.period_end)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
