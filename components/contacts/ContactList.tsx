"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Pencil, Search, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { formatPhone, whatsappUrl } from "@/lib/contacts/phone";
import { deleteContactAction, updateContactAction } from "@/app/app/contacts/actions";

export interface ContactRowData {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  notes: string | null;
  consent: boolean;
  opted_out: boolean;
  // e.g. "3 days ago", worked out on the server so it matches what the page was built with
  lastMessaged: string | null;
}

const MAX_ROWS = 100;

function Status({ contact }: { contact: ContactRowData }) {
  if (contact.opted_out) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Asked to stop</span>;
  if (contact.consent) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Agreed to messages</span>;
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Not agreed yet</span>;
}

export function ContactList({ contacts }: { contacts: ContactRowData[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return contacts.filter((c) => {
      if (tag && !c.tags.includes(tag)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)) || c.tags.some((t) => t.includes(q));
    });
  }, [contacts, query, tag]);

  const shown = matches.slice(0, MAX_ROWS);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink-900">
          Your customers <span className="text-sm font-normal text-ink-400">({contacts.length.toLocaleString("en-IN")})</span>
        </h2>
      </div>

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
          No customers yet. Add one above, or paste a whole list.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search customers"
                className="field-input pl-9"
                placeholder="Search by name, number or tag"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {allTags.length > 0 && (
              <select aria-label="Filter by tag" className="field-input w-auto" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-500">No customers match that.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {shown.map((c) => (
                <li key={c.id} className="py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-900">{c.name}</span>
                        <Status contact={c} />
                      </div>
                      <div className="mt-0.5 text-sm text-ink-600 [font-variant-numeric:tabular-nums]">{formatPhone(c.phone)}</div>
                      {(c.tags.length > 0 || c.lastMessaged) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                          {c.tags.map((t) => (
                            <span key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-700">
                              {t}
                            </span>
                          ))}
                          {c.lastMessaged && <span>Last messaged {c.lastMessaged}</span>}
                        </div>
                      )}
                      {c.notes && <p className="mt-1 text-sm text-ink-500">{c.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.consent && !c.opted_out && (
                        <a
                          href={whatsappUrl(c.phone, "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary px-3 py-1.5 text-sm"
                          aria-label={`Chat with ${c.name} on WhatsApp`}
                        >
                          <MessageCircle className="mr-1.5 h-4 w-4 text-emerald-600" /> Chat
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-sm"
                        onClick={() => {
                          setEditing(editing === c.id ? null : c.id);
                          setConfirmDelete(null);
                        }}
                        aria-expanded={editing === c.id}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" /> {editing === c.id ? "Close" : "Edit"}
                      </button>
                    </div>
                  </div>

                  {editing === c.id && (
                    <div className="mt-3 space-y-3 rounded-lg border border-ink-100 bg-ink-50 p-4">
                      <ActionForm action={updateContactAction} className="space-y-3">
                        {(state) => (
                          <>
                            <input type="hidden" name="id" value={c.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label htmlFor={`name-${c.id}`} className="mb-1 block text-xs font-medium text-ink-700">
                                  Name
                                </label>
                                <input id={`name-${c.id}`} name="name" defaultValue={c.name} required maxLength={80} className="field-input" />
                              </div>
                              <div>
                                <label htmlFor={`tags-${c.id}`} className="mb-1 block text-xs font-medium text-ink-700">
                                  Tags
                                </label>
                                <input id={`tags-${c.id}`} name="tags" defaultValue={c.tags.join(", ")} className="field-input" placeholder="vip, wedding" />
                              </div>
                              <div className="sm:col-span-2">
                                <label htmlFor={`notes-${c.id}`} className="mb-1 block text-xs font-medium text-ink-700">
                                  Note
                                </label>
                                <input id={`notes-${c.id}`} name="notes" defaultValue={c.notes ?? ""} maxLength={300} className="field-input" />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-ink-800">
                              <input type="checkbox" name="consent" defaultChecked={c.consent} className="h-4 w-4 rounded border-ink-300" />
                              Agreed to receive messages from my business
                            </label>
                            <label className="flex items-center gap-2 text-sm text-ink-800">
                              <input type="checkbox" name="optedOut" defaultChecked={c.opted_out} className="h-4 w-4 rounded border-ink-300" />
                              Asked me to stop messaging them
                            </label>
                            <div className="flex flex-wrap items-center gap-3">
                              <SubmitButton className="btn-primary px-4 py-2" pendingLabel="Saving…">
                                Save
                              </SubmitButton>
                              {state.message && <span className="text-sm font-medium text-emerald-700">{state.message}</span>}
                            </div>
                            <FormError message={state.error} />
                          </>
                        )}
                      </ActionForm>

                      <div className="border-t border-ink-200 pt-3">
                        {confirmDelete === c.id ? (
                          <ActionForm action={deleteContactAction} className="flex flex-wrap items-center gap-3">
                            {(state) => (
                              <>
                                <input type="hidden" name="id" value={c.id} />
                                <span className="text-sm text-ink-700">Delete {c.name} from your list for good?</span>
                                <SubmitButton className="btn-danger px-3 py-1.5 text-sm" pendingLabel="Deleting…">
                                  Yes, delete
                                </SubmitButton>
                                <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setConfirmDelete(null)}>
                                  Keep
                                </button>
                                <FormError message={state.error} />
                              </>
                            )}
                          </ActionForm>
                        ) : (
                          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline" onClick={() => setConfirmDelete(c.id)}>
                            <Trash2 className="h-4 w-4" /> Delete this customer
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {matches.length > MAX_ROWS && (
            <p className="text-xs text-ink-500">
              Showing the first {MAX_ROWS} of {matches.length.toLocaleString("en-IN")}. Search or pick a tag to find others.
            </p>
          )}
        </>
      )}
    </section>
  );
}
