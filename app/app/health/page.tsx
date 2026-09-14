import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HealthCenterPanel } from "@/components/HealthCenterPanel";

export default async function ConnectionHealthPage() {
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

  const [{ data: links }, { data: googleConnections }, { data: bufferLinks }] = await Promise.all([
    supabase.from("org_links").select("*").eq("org_id", membership.org_id),
    supabase.from("google_connections").select("service, status").eq("org_id", membership.org_id),
    supabase.from("buffer_channel_links").select("id").eq("org_id", membership.org_id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Connection Health</h1>
        <p className="text-sm text-ink-500">Where every connection stands. Reconnect from Links or SEO if something needs attention.</p>
      </div>
      <div className="card">
        <HealthCenterPanel links={links ?? []} googleConnections={googleConnections ?? []} bufferLinked={(bufferLinks ?? []).length > 0} />
      </div>
    </div>
  );
}
