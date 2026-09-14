import { ClientNav } from "@/components/client/ClientNav";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database";

export default async function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let notifications: Notification[] = [];
  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership) {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
        .limit(20);
      notifications = data ?? [];
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <ClientNav notifications={notifications} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
