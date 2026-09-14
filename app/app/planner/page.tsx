import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ControlModeBar } from "@/components/planner/ControlModeBar";
import { DayCard } from "@/components/planner/DayCard";
import type { ContentMedia, ContentVersion } from "@/types/database";

function nextSevenDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default async function PlannerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/register/details");

  const days = nextSevenDays();

  const [{ data: settings }, { data: items }] = await Promise.all([
    supabase.from("client_settings").select("content_control_mode, approval_then_autopilot").eq("org_id", membership.org_id).maybeSingle(),
    supabase
      .from("content_items")
      .select("*")
      .eq("org_id", membership.org_id)
      .gte("scheduled_date", days[0])
      .lte("scheduled_date", days[days.length - 1])
      .order("created_at", { ascending: true }),
  ]);

  const itemIds = (items ?? []).map((i) => i.id);
  const [{ data: media }, { data: versions }] = itemIds.length
    ? await Promise.all([
        supabase.from("content_media").select("*").in("content_item_id", itemIds),
        supabase.from("content_versions").select("*").in("content_item_id", itemIds).order("version_number", { ascending: false }),
      ])
    : [{ data: [] as ContentMedia[] }, { data: [] as ContentVersion[] }];

  const mediaByItem = new Map<string, ContentMedia[]>();
  (media ?? []).forEach((m) => {
    const list = mediaByItem.get(m.content_item_id) ?? [];
    list.push(m);
    mediaByItem.set(m.content_item_id, list);
  });

  const versionsByItem = new Map<string, ContentVersion[]>();
  (versions ?? []).forEach((v) => {
    const list = versionsByItem.get(v.content_item_id) ?? [];
    list.push(v);
    versionsByItem.set(v.content_item_id, list);
  });

  const itemsByDay = new Map<string, typeof items>();
  (items ?? []).forEach((item) => {
    const list = itemsByDay.get(item.scheduled_date) ?? [];
    list.push(item);
    itemsByDay.set(item.scheduled_date, list);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">7-Day Content Planner</h1>
        <p className="text-sm text-ink-500">
          Content reaches <span className="font-medium text-ink-700">&quot;Scheduled&quot;</span> here — actual
          publishing to Facebook/Instagram/YouTube arrives in a later phase.
        </p>
      </div>

      <ControlModeBar
        mode={settings?.content_control_mode ?? "approval_required"}
        approvalThenAutopilot={settings?.approval_then_autopilot ?? false}
      />

      <div className="space-y-4">
        {days.map((date) => (
          <DayCard key={date} date={date} items={itemsByDay.get(date) ?? []} mediaByItem={mediaByItem} versionsByItem={versionsByItem} />
        ))}
      </div>
    </div>
  );
}
