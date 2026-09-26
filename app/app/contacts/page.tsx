import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddContactForm } from "@/components/contacts/AddContactForm";
import { ImportContactsForm } from "@/components/contacts/ImportContactsForm";
import { MessageComposer } from "@/components/contacts/MessageComposer";
import { ContactList, type ContactRowData } from "@/components/contacts/ContactList";
import { timeAgo } from "@/lib/dashboard/command-center";

export default async function ContactsPage() {
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
  const orgId = membership.org_id;

  const [{ data: org }, { data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("organizations").select("legal_name").eq("id", orgId).maybeSingle(),
    supabase.from("client_settings").select("google_review_link").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("customer_contacts")
      .select("id, name, phone, tags, notes, consent, opted_out, last_messaged_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const now = new Date();
  const contacts: ContactRowData[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    tags: r.tags ?? [],
    notes: r.notes,
    consent: r.consent,
    opted_out: r.opted_out,
    lastMessaged: r.last_messaged_at ? timeAgo(r.last_messaged_at, now) : null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Customers &amp; WhatsApp</h1>
        <p className="text-sm text-ink-500">
          Keep your customers in one place and message them on WhatsApp — festival wishes, offers, a thank-you, a review request.
          You open each chat and press send yourself, so it goes from your own number and never looks like a robot. Only add people who
          agreed to hear from you; anyone who asks you to stop is never listed again.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          The customer list isn&apos;t set up yet. Ask your Digital Command contact to finish the latest update, then reload this page.
        </div>
      )}

      {!error && (
        <>
          <MessageComposer
            contacts={contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, tags: c.tags, consent: c.consent, opted_out: c.opted_out }))}
            business={org?.legal_name ?? "our business"}
            reviewLink={settings?.google_review_link?.trim() || null}
          />
          <AddContactForm />
          <ImportContactsForm />
          <ContactList contacts={contacts} />
        </>
      )}
    </div>
  );
}
