"use client";

import { useState } from "react";
import { Lock, Unlock, Trash2, Copy, CalendarClock, Sparkles, ImagePlus, X } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  generateAiContentAction,
  editContentAction,
  decideContentAction,
  deleteContentItemAction,
  toggleLockContentItemAction,
  rescheduleContentItemAction,
  copyContentItemAction,
  addContentMediaAction,
  removeContentMediaAction,
} from "@/app/app/planner/actions";
import { PLATFORM_LABELS, REJECTIONS_BEFORE_SUGGESTION } from "@/lib/constants/content";
import type { ContentItem, ContentMedia } from "@/types/database";

const SOURCE_LABELS: Record<string, string> = {
  ai_generated: "AI Generated",
  client_uploaded: "Client Uploaded",
  admin_created: "Admin Created",
  gpt_assistant_generated: "GPT/AI Assistant Generated",
};

export function ContentItemCard({ item, media }: { item: ContentItem; media: ContentMedia[] }) {
  const [editing, setEditing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [copying, setCopying] = useState(false);
  const [addingMedia, setAddingMedia] = useState(false);

  const needsSuggestion = item.rejection_count >= REJECTIONS_BEFORE_SUGGESTION;
  const finalRoundUsed = item.rejection_count > REJECTIONS_BEFORE_SUGGESTION;
  const decidable = ["draft", "waiting_approval", "rejected"].includes(item.status);
  const canRegenerate = decidable && !finalRoundUsed;

  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-900">{PLATFORM_LABELS[item.platform]}</span>
        <StatusBadge status={item.status} />
        <span className="text-xs text-ink-400">{SOURCE_LABELS[item.source]}</span>
        {item.locked && <Lock className="h-3.5 w-3.5 text-ink-400" />}
        {item.scheduled_time && <span className="text-xs text-ink-400">{item.scheduled_time}</span>}
      </div>

      {editing ? (
        <ActionForm action={editContentAction} className="mb-3 space-y-2">
          {(state) => (
            <>
              <input type="hidden" name="id" value={item.id} />
              <FormError message={state.error} />
              <textarea className="field-input" name="caption" defaultValue={item.caption ?? ""} rows={3} />
              <input
                className="field-input"
                name="hashtags"
                defaultValue={item.hashtags.join(" ")}
                placeholder="hashtag1 hashtag2"
              />
              <div className="flex gap-2">
                <SubmitButton className="btn-primary px-3 py-1.5 text-sm" pendingLabel="Saving…">
                  Save Edit
                </SubmitButton>
                <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </ActionForm>
      ) : (
        <>
          <p className="mb-1 whitespace-pre-line text-sm text-ink-800">{item.caption || "(no caption)"}</p>
          {item.hashtags.length > 0 && (
            <p className="mb-2 text-xs text-brand-600">{item.hashtags.map((h) => `#${h}`).join(" ")}</p>
          )}
        </>
      )}

      {media.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {media.map((m) => (
            <div key={m.id} className="flex items-center gap-1 rounded border border-ink-100 px-2 py-1 text-xs text-ink-500">
              {m.media_type}
              <ActionForm action={removeContentMediaAction}>
                {() => (
                  <>
                    <input type="hidden" name="mediaId" value={m.id} />
                    <button type="submit" aria-label="Remove media" className="text-ink-400 hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </ActionForm>
            </div>
          ))}
        </div>
      )}

      {!item.locked && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-50 pt-3">
          {decidable && (
            <ActionForm action={decideContentAction}>
              {(state) => (
                <>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" name="decision" value="approve" className="btn-primary px-3 py-1.5 text-xs">
                    Approve
                  </button>
                  <FormError message={state.error} />
                </>
              )}
            </ActionForm>
          )}
          {!editing && decidable && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {decidable && (
            <ActionForm action={decideContentAction}>
              {() => (
                <>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" name="decision" value="reject" className="btn-secondary px-3 py-1.5 text-xs">
                    Reject
                  </button>
                </>
              )}
            </ActionForm>
          )}

          {canRegenerate && !needsSuggestion && (
            <ActionForm action={generateAiContentAction}>
              {(state) => (
                <>
                  <input type="hidden" name="contentItemId" value={item.id} />
                  <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingLabel="Generating…">
                    <Sparkles className="mr-1 inline h-3 w-3" /> Generate Another
                  </SubmitButton>
                  <FormError message={state.error} />
                </>
              )}
            </ActionForm>
          )}

          {canRegenerate && needsSuggestion && !suggesting && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setSuggesting(true)}>
              Add My Suggestion
            </button>
          )}

          {decidable && (
            <ActionForm action={decideContentAction}>
              {() => (
                <>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" name="decision" value="skip" className="btn-secondary px-3 py-1.5 text-xs">
                    Skip Today
                  </button>
                </>
              )}
            </ActionForm>
          )}

          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setAddingMedia((v) => !v)}>
            <ImagePlus className="mr-1 inline h-3 w-3" /> Media
          </button>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setRescheduling((v) => !v)}>
            <CalendarClock className="mr-1 inline h-3 w-3" /> Reschedule
          </button>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setCopying((v) => !v)}>
            <Copy className="mr-1 inline h-3 w-3" /> Copy
          </button>

          <ActionForm action={deleteContentItemAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
                  <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                </button>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
        </div>
      )}

      <ActionForm action={toggleLockContentItemAction} className="mt-2">
        {() => (
          <>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700">
              {item.locked ? (
                <>
                  <Unlock className="h-3 w-3" /> Unlock
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" /> Lock this item
                </>
              )}
            </button>
          </>
        )}
      </ActionForm>

      {suggesting && (
        <ActionForm action={generateAiContentAction} className="mt-3 space-y-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="contentItemId" value={item.id} />
              <FormError message={state.error} />
              <label className="field-label">Your suggestion</label>
              <textarea className="field-input" name="clientSuggestion" rows={2} required />
              <SubmitButton className="btn-primary px-3 py-1.5 text-sm" pendingLabel="Generating…">
                Generate From Suggestion
              </SubmitButton>
            </>
          )}
        </ActionForm>
      )}

      {rescheduling && (
        <ActionForm action={rescheduleContentItemAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label className="field-label">Date</label>
                <input className="field-input" type="date" name="scheduledDate" defaultValue={item.scheduled_date} required />
              </div>
              <div>
                <label className="field-label">Time (optional)</label>
                <input className="field-input" type="time" name="scheduledTime" defaultValue={item.scheduled_time ?? ""} />
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm">Save</SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      {copying && (
        <ActionForm action={copyContentItemAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label className="field-label">Copy to date</label>
                <input className="field-input" type="date" name="targetDate" required />
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm">Copy</SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      {addingMedia && (
        <ActionForm action={addContentMediaAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-ink-50 p-3">
          {(state) => (
            <>
              <input type="hidden" name="contentItemId" value={item.id} />
              <div>
                <label className="field-label">Add image or video</label>
                <input className="field-input" type="file" name="media" accept="image/*,video/*" required />
              </div>
              <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingLabel="Uploading…">
                Add
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
