// The "essentials" every local listing needs to agree on. One definition used
// by both the Local SEO page's checklist and the Visibility Score, so the two
// can never disagree about what counts as filled in.
export interface NapSources {
  local: { address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; gbp_url?: string | null } | null;
  brand: { phone?: string | null; whatsapp?: string | null } | null;
}

export function getNapFields({ local, brand }: NapSources): { label: string; filled: boolean }[] {
  return [
    { label: "Address (Local SEO profile)", filled: Boolean(local?.address?.trim()) },
    { label: "City/State/Pincode", filled: Boolean(local?.city?.trim() && local?.state?.trim() && local?.pincode?.trim()) },
    { label: "Phone or WhatsApp (Brand Brain)", filled: Boolean(brand?.phone?.trim() || brand?.whatsapp?.trim()) },
    { label: "Google Business Profile link", filled: Boolean(local?.gbp_url?.trim()) },
  ];
}
