import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ControlModeBar } from "@/components/planner/ControlModeBar";
import { DayCard } from "@/components/planner/DayCard";
import { WindowSelector } from "@/components/planner/WindowSelector";
import { ClearPlannerButton } from "@/components/planner/ClearPlannerButton";
import { InsightsSummary } from "@/components/planner/InsightsSummary";
import { summarizeInsights } from "@/lib/planner/insights";
import { PLANNER_WINDOW_OPTIONS, type PlannerWindow } from "@/lib/constants/content";
import type { ContentMedia, ContentVersion } from "@/types/database";

export type ContentMediaWithUrl = ContentMedia & { signedUrl: string | null };

function nextNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default async function PlannerPage({ searchParams }: { searchParams: { days?: string } }) {
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

  const requestedWindow = Number(searchParams.days);
  const windowDays: PlannerWindow = PLANNER_WINDOW_OPTIONS.includes(requestedWindow as PlannerWindow)
    ? (requestedWindow as PlannerWindow)
    : 7;

  const days = nextNDays(windowDays);

  const [{ data: settings }, { data: items }] = await Promise.all([
    supabase
      .from("client_settings")
      .select("content_control_mode, approval_then_autopilot, autopilot_platforms")
      .eq("org_id", membership.org_id)
      .maybeSingle(),
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

  const mediaWithUrls: ContentMediaWithUrl[] = await Promise.all(
    (media ?? []).map(async (m) => {
      const { data } = await supabase.storage.from("content-media").createSignedUrl(m.storage_path, 300);
      return { ...m, signedUrl: data?.signedUrl ?? null };
    })
  );

  const mediaByItem = new Map<string, ContentMediaWithUrl[]>();
  mediaWithUrls.forEach((m) => {
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

  const insights = summarizeInsights(
    (items ?? []).map((i) => ({
      status: i.status,
      buffer_post_id: i.buffer_post_id,
      insights: i.insights ?? [],
      insights_synced_at: i.insights_synced_at,
    }))
  );

  const itemsByDay = new Map<string, typeof items>();
  (items ?? []).forEach((item) => {
    const list = itemsByDay.get(item.scheduled_date) ?? [];
    list.push(item);
    itemsByDay.set(item.scheduled_date, list);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-ink-900">Content Planner</h1>
          <p className="text-sm text-ink-500">
            Approved posts become <span className="font-medium text-ink-700">&quot;Scheduled&quot;</span> and are sent
            to Facebook/Instagram (via Buffer) or uploaded to YouTube once a publishing channel is connected. Times are
            in Indian Standard Time.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <WindowSelector current={windowDays} />
          <ClearPlannerButton startDate={days[0]} endDate={days[days.length - 1]} windowLabel={`${windowDays}-day`} />
        </div>
      </div>

      <ControlModeBar
        mode={settings?.content_control_mode ?? "approval_required"}
        approvalThenAutopilot={settings?.approval_then_autopilot ?? false}
        autopilotPlatforms={settings?.autopilot_platforms ?? []}
      />

      {insights.publishedCount > 0 && (
        <InsightsSummary
          startDate={days[0]}
          endDate={days[days.length - 1]}
          publishedCount={insights.publishedCount}
          syncedCount={insights.syncedCount}
          totals={insights.totals}
          lastSyncedAt={insights.lastSyncedAt}
        />
      )}

      <div className="space-y-4">
        {days.map((date) => (
          <DayCard key={date} date={date} items={itemsByDay.get(date) ?? []} mediaByItem={mediaByItem} versionsByItem={versionsByItem} />
        ))}
      </div>
    </div>
  );
}
