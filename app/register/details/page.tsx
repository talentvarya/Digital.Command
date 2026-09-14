import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import { REQUIRED_POLICY_TYPES } from "@/lib/constants/policies";
import { DetailsForm } from "@/components/registration/DetailsForm";

export default async function RegisterDetailsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/register/details");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    redirect(await getPostLoginRedirect(supabase, user.id));
  }

  const { data: policies } = await supabase
    .from("policy_versions")
    .select("id, policy_type, title, body")
    .in("policy_type", REQUIRED_POLICY_TYPES)
    .eq("is_current", true);

  return <DetailsForm policies={policies ?? []} />;
}
