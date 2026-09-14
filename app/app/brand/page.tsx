import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandForm } from "@/components/brand/BrandForm";

export default async function BrandPage() {
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

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("org_id", membership.org_id)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (brand?.logo_path) {
    const { data } = await supabase.storage.from("brand-assets").createSignedUrl(brand.logo_path, 300);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-ink-900">Brand Brain</h1>
      <p className="mb-6 text-sm text-ink-500">
        Every piece of AI-generated content consults this profile first (spec §18).
      </p>
      <BrandForm brand={brand ?? null} logoUrl={logoUrl} />
    </div>
  );
}
