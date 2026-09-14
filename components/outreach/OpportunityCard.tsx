"use client";

import { useState } from "react";
import { Mail, Link2, RefreshCw, Sparkles } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  updateOpportunityAction,
  draftOutreachAction,
  markOutreachSentAction,
  checkBacklinkAction,
} from "@/app/app/outreach/actions";
import type { OffPageOpportunity, OpportunityStatus, OutreachMessage } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  guest_contribution: "Guest Contribution",
  broken_link: "Broken-Link Replacement",
  unlinked_mention: "Unlinked Mention",
  other: "Other",
};

const STATUS_OPTIONS: OpportunityStatus[] = [
  "new",
  "assessed",
  "contacted",
  "awaiting_response",
  "link_acquired",
  "declined",
  "lost",
];

const SPAM_COLOR: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

function mailtoHref(email: string | null, subject: string | null, body: string) {
  if (!email) return undefined;
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  params.set("body", body);
  return `mailto:${email}?${params.toString()}`;
}

export function OpportunityCard({ opportunity, messages }: { opportunity: OffPageOpportunity; messages: OutreachMessage[] }) {
  const [editingContact, setEditingContact] = useState(false);
  const hasSentBefore = messages.some((m) => m.status === "sent");
  const latestDraft = messages.find((m) => m.status === "draft");

  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-ink-400">{TYPE_LABELS[opportunity.opportunity_type]}</span>
        <StatusBadge status={opportunity.status} />
        {opportunity.spam_risk && (
          <span className={`text-xs font-medium ${SPAM_COLOR[opportunity.spam_risk]}`}>
            {opportunity.spam_risk} spam risk
          </span>
        )}
        {opportunity.relevance_score !== null && (
          <span className="text-xs text-ink-500">Relevance {opportunity.relevance_score}/100</span>
        )}
      </div>

      <a href={opportunity.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">
        {opportunity.url}
      </a>
      {opportunity.quality_notes && <p className="mt-1 text-sm text-ink-600">{opportunity.quality_notes}</p>}

      <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
        {opportunity.contact_email ? (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" /> {opportunity.contact_email}
          </span>
        ) : (
          <span>No contact found</span>
        )}
        <button className="text-brand-600 underline" onClick={() => setEditingContact((v) => !v)}>
          Edit
        </button>
      </div>

      {editingContact && (
        <ActionForm action={updateOpportunityAction} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="id" value={opportunity.id} />
              <div>
                <label className="field-label">Contact email</label>
                <input className="field-input" name="contactEmail" defaultValue={opportunity.contact_email ?? ""} />
              </div>
              <div>
                <label className="field-label">Contact name</label>
                <input className="field-input" name="contactName" defaultValue={opportunity.contact_name ?? ""} />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select name="status" className="field-input" defaultValue={opportunity.status}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm">Save</SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-50 pt-3">
        <ActionForm action={draftOutreachAction}>
          {(state) => (
            <>
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <input type="hidden" name="isFollowUp" value={String(hasSentBefore)} />
              <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Drafting…">
                <Sparkles className="mr-1 inline h-3 w-3" /> {hasSentBefore ? "Draft Follow-Up" : "Draft Outreach"}
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>

        {["contacted", "awaiting_response", "link_acquired", "lost"].includes(opportunity.status) && (
          <ActionForm action={checkBacklinkAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={opportunity.id} />
                <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Checking…">
                  <Link2 className="mr-1 inline h-3 w-3" /> Check Backlink
                </SubmitButton>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
        )}
      </div>

      {opportunity.link_last_checked_at && (
        <p className="mt-1 text-xs text-ink-400">
          {opportunity.link_verified ? "Link confirmed" : "Link not found"} — last checked{" "}
          {new Date(opportunity.link_last_checked_at).toLocaleString()}
        </p>
      )}

      {messages.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-ink-50 pt-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-ink-50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-ink-800">{m.subject}</span>
                <StatusBadge status={m.status} />
              </div>
              <p className="whitespace-pre-line text-ink-600">{m.body}</p>
              {m.status === "draft" && (
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={mailtoHref(opportunity.contact_email, m.subject, m.body)}
                    className={`btn-secondary px-3 py-1.5 text-xs ${!opportunity.contact_email ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Mail className="mr-1 inline h-3 w-3" /> Open in Email
                  </a>
                  <ActionForm action={markOutreachSentAction}>
                    {() => (
                      <>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="opportunityId" value={opportunity.id} />
                        <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                          Mark Sent
                        </button>
                      </>
                    )}
                  </ActionForm>
                </div>
              )}
              {m.status === "sent" && m.follow_up_due_at && (
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                  <RefreshCw className="h-3 w-3" /> Follow up by {m.follow_up_due_at}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {latestDraft && (
        <p className="mt-2 text-xs text-amber-600">Unsent draft above — open in your email client or mark it sent.</p>
      )}
    </div>
  );
}
