import { formatInr } from "@/lib/constants/plans";

export function FunnelSummary({
  organicClicks,
  sessions,
  eventCounts,
}: {
  organicClicks: number | null;
  sessions: number | null;
  eventCounts: Record<string, { count: number; value: number }>;
}) {
  const stages: { label: string; value: string }[] = [
    { label: "Google Organic Clicks", value: organicClicks !== null ? String(organicClicks) : "—" },
    { label: "Website Visitors", value: sessions !== null ? String(sessions) : "—" },
    { label: "WhatsApp/Call/Form Clicks", value: String(eventCounts.click?.count ?? 0) },
    { label: "Leads", value: String(eventCounts.lead?.count ?? 0) },
    { label: "Bookings", value: String(eventCounts.booking?.count ?? 0) },
    { label: "Sales", value: `${eventCounts.sale?.count ?? 0}${eventCounts.sale?.value ? ` (${formatInr(eventCounts.sale.value)})` : ""}` },
  ];

  return (
    <div className="card">
      <h2 className="mb-1 text-sm font-semibold text-ink-900">Funnel — last 30 days</h2>
      <p className="mb-3 text-xs text-ink-400">
        Organic clicks and visitors come from Search Console/Analytics (SEO module). Everything after that is what you&apos;re tracking here.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="text-xs uppercase text-ink-400">{s.label}</div>
            <div className="text-lg font-semibold text-ink-900">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
