"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import {
  availableTemplates,
  pickAudience,
  renderMessage,
  unresolvedPlaceholders,
  type AudienceContact,
} from "@/lib/contacts/messages";
import { formatPhone, whatsappUrl } from "@/lib/contacts/phone";
import { markMessagedAction } from "@/app/app/contacts/actions";

const MAX_ROWS = 50;
const MAX_MESSAGE = 1000;

// Pick a message, then open it in WhatsApp for each customer who agreed. The
// client presses send in WhatsApp themselves — nothing is sent from here — and
// the list is capped so a whole book of customers can't be blasted in one go.
export function MessageComposer({
  contacts,
  business,
  reviewLink,
}: {
  contacts: AudienceContact[];
  business: string;
  reviewLink: string | null;
}) {
  const templates = useMemo(() => availableTemplates(Boolean(reviewLink)), [reviewLink]);
  const [templateKey, setTemplateKey] = useState(templates[0].key);
  const [text, setText] = useState(templates[0].text);
  const [tag, setTag] = useState<string>("");
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const { sendable, withoutConsent, optedOut } = useMemo(() => pickAudience(contacts, tag || null), [contacts, tag]);
  const gaps = unresolvedPlaceholders(text);
  const tooLong = text.length > MAX_MESSAGE;
  const ready = text.trim().length > 0 && gaps.length === 0 && !tooLong;
  const shown = sendable.slice(0, MAX_ROWS);

  const preview = renderMessage(text, { name: shown[0]?.name ?? "Ravi", business, reviewLink });

  function chooseTemplate(key: string) {
    const template = templates.find((t) => t.key === key);
    if (!template) return;
    setTemplateKey(key);
    setText(template.text);
  }

  function noteOpened(id: string) {
    setOpened((prev) => new Set(prev).add(id));
    // Record it on the customer; a failure here never blocks opening WhatsApp.
    const data = new FormData();
    data.set("id", id);
    void markMessagedAction({}, data).catch(() => undefined);
  }

  const english = templates.filter((t) => t.language === "English");
  const hindi = templates.filter((t) => t.language === "Hindi");

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <MessageCircle className="h-5 w-5 text-emerald-600" /> Message your customers on WhatsApp
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Pick a message, then tap <span className="font-medium text-ink-700">Open WhatsApp</span> next to each person. WhatsApp opens
          with the message ready and <span className="font-medium text-ink-700">you press send yourself</span> — so it goes from your own number, one
          person at a time. Only customers who agreed to hear from you are listed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="composer-template" className="mb-1 block text-sm font-medium text-ink-700">
            Message
          </label>
          <select id="composer-template" className="field-input" value={templateKey} onChange={(e) => chooseTemplate(e.target.value)}>
            <optgroup label="English">
              {english.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="हिन्दी (Hindi)">
              {hindi.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="composer-tag" className="mb-1 block text-sm font-medium text-ink-700">
            Send to
          </label>
          <select id="composer-tag" className="field-input" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Everyone who agreed</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                Tagged “{t}”
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="composer-text" className="mb-1 block text-sm font-medium text-ink-700">
          Your message — edit it as you like
        </label>
        <textarea id="composer-text" rows={6} className="field-input" value={text} onChange={(e) => setText(e.target.value)} />
        <p className="mt-1 text-xs text-ink-500">
          <code>{"{name}"}</code> becomes each customer&apos;s first name and <code>{"{business}"}</code> your business name.
          {text.includes("{details}") && (
            <>
              {" "}
              Replace <code>{"{details}"}</code> with your own words (the offer, the wish, the date…).
            </>
          )}
        </p>
        {gaps.length > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Replace {gaps.join(", ")} with your own words before sending.
            </span>
          </p>
        )}
        {tooLong && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            That message is {text.length.toLocaleString("en-IN")} characters — please keep it under {MAX_MESSAGE.toLocaleString("en-IN")}.
          </p>
        )}
      </div>

      {ready && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
            What {shown[0] ? firstNameOf(shown[0].name) : "Ravi"} will see
          </div>
          <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-emerald-50 px-4 py-3 text-sm text-ink-800 ring-1 ring-emerald-100">{preview}</div>
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-900">
            {sendable.length === 0 ? "Nobody to message yet" : `${sendable.length} ${sendable.length === 1 ? "person" : "people"}`}
          </h3>
          {(withoutConsent > 0 || optedOut > 0) && (
            <p className="text-xs text-ink-500">
              Not listed:{" "}
              {[withoutConsent > 0 ? `${withoutConsent} haven't agreed yet` : null, optedOut > 0 ? `${optedOut} asked to stop` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        {sendable.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
            Add customers below and tick that they agreed to receive messages — they&apos;ll appear here.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {shown.map((c) => {
              const url = whatsappUrl(c.phone, renderMessage(text, { name: c.name, business, reviewLink }));
              const done = opened.has(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-900">{c.name}</div>
                    <div className="text-xs text-ink-500 [font-variant-numeric:tabular-nums]">{formatPhone(c.phone)}</div>
                  </div>
                  {ready ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => noteOpened(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition ${
                        done ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {done ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Opened — open again
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-4 w-4" /> Open WhatsApp
                        </>
                      )}
                    </a>
                  ) : (
                    <span className="rounded-lg border border-ink-200 px-3.5 py-2 text-sm text-ink-400" aria-disabled="true">
                      Finish the message first
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {sendable.length > MAX_ROWS && (
          <p className="mt-2 text-xs text-ink-500">
            Showing the first {MAX_ROWS} of {sendable.length}. To reach the others, choose a tag above — sending in smaller groups keeps your messages personal
            and is kinder to your WhatsApp number.
          </p>
        )}
      </div>
    </section>
  );
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "Ravi";
}
