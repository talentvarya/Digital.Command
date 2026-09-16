"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Phone, Mail } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { updateLeadStatusAction } from "@/app/admin/leads/actions";
import type { LeadStatus, RoadmapLead } from "@/types/database";

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "converted", "not_interested"];

export function LeadCard({ lead }: { lead: RoadmapLead }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-ink-900">{lead.business_name}</h3>
            <StatusBadge status={lead.status} />
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-ink-500">
              {lead.language === "hi" ? "Hinglish" : "English"}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-600">
            {lead.contact_name} · {lead.industry || "industry not given"} {lead.city ? `· ${lead.city}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            <a href={`tel:${lead.contact_phone}`} className="flex items-center gap-1 hover:text-brand-600">
              <Phone className="h-3 w-3" /> {lead.contact_phone}
            </a>
            {lead.contact_email && (
              <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-1 hover:text-brand-600">
                <Mail className="h-3 w-3" /> {lead.contact_email}
              </a>
            )}
            <span>{new Date(lead.created_at).toLocaleString()}</span>
          </div>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="btn-secondary px-3 py-1.5 text-xs">
          {expanded ? (
            <>
              <ChevronUp className="mr-1 inline h-3 w-3" /> Hide roadmap
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 inline h-3 w-3" /> View roadmap
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-ink-50 pt-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p><span className="text-ink-400">Goal:</span> {lead.primary_goal || "—"}</p>
            <p><span className="text-ink-400">Timeline:</span> {lead.timeline || "—"}</p>
            <p><span className="text-ink-400">Budget:</span> {lead.budget_range || "—"}</p>
            <p><span className="text-ink-400">Audience:</span> {lead.target_audience || "—"}</p>
            <p><span className="text-ink-400">Competitors:</span> {lead.competitors || "—"}</p>
            <p><span className="text-ink-400">Current marketing:</span> {lead.current_marketing || "—"}</p>
          </div>

          {lead.roadmap_current_state.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-ink-800">Current state</p>
              <ul className="list-inside list-disc text-ink-600">
                {lead.roadmap_current_state.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {lead.roadmap_phases.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-ink-800">Roadmap phases</p>
              <div className="space-y-2">
                {lead.roadmap_phases.map((p, i) => (
                  <div key={i} className="rounded-lg bg-ink-50 p-2.5">
                    <p className="font-medium text-ink-800">
                      {p.title} <span className="text-xs text-ink-400">({p.timeframe})</span>
                    </p>
                    <ul className="mt-1 list-inside list-disc text-ink-600">
                      {p.points.map((pt, j) => (
                        <li key={j}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lead.roadmap_vision && (
            <div>
              <p className="mb-1 font-medium text-ink-800">Vision</p>
              <p className="italic text-ink-600">{lead.roadmap_vision}</p>
            </div>
          )}

          <ActionForm action={updateLeadStatusAction} className="flex flex-wrap items-end gap-2 border-t border-ink-50 pt-3">
            {(state) => (
              <>
                <input type="hidden" name="id" value={lead.id} />
                <div>
                  <label className="field-label">Status</label>
                  <select name="status" className="field-input" defaultValue={lead.status}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="field-label">Notes</label>
                  <input className="field-input" name="notes" defaultValue={lead.notes ?? ""} />
                </div>
                <SubmitButton className="btn-primary px-3 py-2 text-sm">Save</SubmitButton>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
        </div>
      )}
    </div>
  );
}
