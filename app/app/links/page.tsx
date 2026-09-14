import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddLinkForm } from "@/components/links/AddLinkForm";
import { LinkRow } from "@/components/links/LinkRow";

export default async function LinksPage() {
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

  const { data: links } = await supabase
    .from("org_links")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Website & Channel Connections</h1>
        <p className="text-sm text-ink-500">
          Store the URLs for your website and channels, and check they&apos;re reachable. Full authenticated
          publishing connections for Facebook/Instagram/YouTube/GBP arrive in a later phase.
        </p>
      </div>

      <AddLinkForm />

      <div className="card p-0">
        {(links ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-400">No links added yet.</p>
        ) : (
          <div className="divide-y divide-ink-50 px-4">
            {(links ?? []).map((link) => (
              <LinkRow key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
