import { createClient } from "@/lib/supabase/server";
import { LeadCard } from "@/components/admin/LeadCard";
import type { RoadmapLead } from "@/types/database";

export default async function AdminLeadsPage() {
  const supabase = createClient();

  const { data: leads } = await supabase.from("roadmap_leads").select("*").order("created_at", { ascending: false });
  const leadList = (leads ?? []) as RoadmapLead[];

  const newCount = leadList.filter((l) => l.status === "new").length;
  const convertedCount = leadList.filter((l) => l.status === "converted").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Roadmap Leads</h1>
        <p className="text-sm text-ink-500">
          Everyone who used the free roadmap tool on the homepage — follow up while it&apos;s fresh. No client ever
          sees this page.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Total leads</div>
          <div className="text-2xl font-bold text-ink-900">{leadList.length}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Not yet contacted</div>
          <div className="text-2xl font-bold text-ink-900">{newCount}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-ink-400">Converted</div>
          <div className="text-2xl font-bold text-ink-900">{convertedCount}</div>
        </div>
      </div>

      <div className="space-y-3">
        {leadList.length === 0 && <p className="card text-center text-sm text-ink-400">No leads yet.</p>}
        {leadList.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}
