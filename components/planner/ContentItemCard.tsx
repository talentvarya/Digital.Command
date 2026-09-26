"use client";

import { useState } from "react";
import { Lock, Unlock, Trash2, Copy, CalendarClock, Sparkles, ImagePlus, X, History, BarChart3, Wand2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { CreativeStudioPanel } from "@/components/planner/CreativeStudioPanel";
import { graphicBlockedReason } from "@/lib/creative/eligibility";
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
  checkPublishStatusAction,
  sendNowAction,
  syncPostInsightsAction,
  restoreContentVersionAction,
} from "@/app/app/planner/actions";
import { normalizeSlotTime } from "@/lib/publishing/schedule";
import { PLATFORM_LABELS, REJECTIONS_BEFORE_SUGGESTION } from "@/lib/constants/content";
import type { ContentItem, ContentVersion } from "@/types/database";
import type { ContentMediaWithUrl } from "@/app/app/planner/page";

const SOURCE_LABELS: Record<string, string> = {
  ai_generated: "AI Generated",
  client_uploaded: "Client Uploaded",
  admin_created: "Admin Created",
  gpt_assistant_generated: "GPT/AI Assistant Generated",
};

const VERSION_LABELS: Record<string, string> = {
  ai: "AI generated",
  client_suggestion: "AI, from your suggestion",
  client_edit: "You edited",
  admin: "Admin edited",
  gpt_assistant: "AI Assistant",
  restored: "Restored",
};

function SendNowButton({ id, label }: { id: string; label: string }) {
  return (
    <ActionForm action={sendNowAction}>
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <SubmitButton className="text-brand-600 underline" pendingLabel="Sending…">
            {label}
          </SubmitButton>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}

export function ContentItemCard({
  item,
  media,
  versions,
  aiPhotosAvailable,
}: {
  item: ContentItem;
  media: ContentMediaWithUrl[];
  versions: ContentVersion[];
  aiPhotosAvailable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [copying, setCopying] = useState(false);
  const [addingMedia, setAddingMedia] = useState(false);
  const [makingImage, setMakingImage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const canMakeGraphic = graphicBlockedReason(item) === null;
  const hasGraphic = media.some((m) => m.storage_path.includes("-creative."));

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
        {item.scheduled_time && <span className="text-xs text-ink-400">{normalizeSlotTime(item.scheduled_time)}</span>}
      </div>

      {(item.status === "scheduled" || item.status === "published") && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          {item.publish_status === "not_sent" && (
            <>
              <span className="text-ink-400">Not sent yet — it goes out automatically once a publishing channel is connected.</span>
              {item.status === "scheduled" && <SendNowButton id={item.id} label="Send now" />}
            </>
          )}
          {item.publish_status === "sent" && item.status !== "published" && (
            <>
              <span className="text-brand-600">Sent — awaiting confirmation</span>
              <ActionForm action={checkPublishStatusAction}>
                {(state) => (
                  <>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton className="text-brand-600 underline" pendingLabel="Checking…">
                      Check Status
                    </SubmitButton>
                    <FormError message={state.error} />
                  </>
                )}
              </ActionForm>
            </>
          )}
          {item.status === "published" && <span className="text-emerald-700">Published ✓</span>}
          {item.publish_status === "error" && (
            <>
              <span className="text-red-600">Publish error: {item.publish_error}</span>
              {item.status === "scheduled" && <SendNowButton id={item.id} label="Retry" />}
            </>
          )}
        </div>
      )}

      {item.status === "published" && item.buffer_post_id && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-ink-50 px-3 py-2 text-xs">
          {item.insights.length > 0 ? (
            <>
              {item.insights.map((m) => (
                <span key={m.name} className="flex items-center gap-1 text-ink-700">
                  <BarChart3 className="h-3 w-3 text-ink-400" />
                  <span className="font-semibold [font-variant-numeric:tabular-nums]">{m.value}</span>
                  <span className="text-ink-400">{m.name.replace(/_/g, " ")}</span>
                </span>
              ))}
              {item.insights_synced_at && (
                <span className="text-ink-400">as of {new Date(item.insights_synced_at).toLocaleString()}</span>
              )}
            </>
          ) : (
            <span className="text-ink-400">No insights synced yet.</span>
          )}
          <ActionForm action={syncPostInsightsAction}>
            {(state) => (
              <>
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton className="text-brand-600 underline" pendingLabel="Refreshing…">
                  Refresh insights
                </SubmitButton>
                <FormError message={state.error} />
              </>
            )}
          </ActionForm>
        </div>
      )}

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
          {media.map((m) =>
            m.media_type === "image" && m.signedUrl ? (
              <div key={m.id} className="group relative h-28 w-28 overflow-hidden rounded-lg border border-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset next/image can optimize */}
                <img src={m.signedUrl} alt="" className="h-full w-full object-cover" />
                <ActionForm action={removeContentMediaAction}>
                  {() => (
                    <>
                      <input type="hidden" name="mediaId" value={m.id} />
                      <button
                        type="submit"
                        aria-label="Remove media"
                        className="absolute right-1 top-1 rounded-full bg-ink-900/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </ActionForm>
              </div>
            ) : (
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
            )
          )}
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

          {canMakeGraphic && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setMakingImage((v) => !v)}>
              <Wand2 className="mr-1 inline h-3 w-3" /> {hasGraphic ? "New image" : "Create image"}
            </button>
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
          {versions.length > 0 && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setShowHistory((v) => !v)}>
              <History className="mr-1 inline h-3 w-3" /> History ({versions.length})
            </button>
          )}

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
                <input className="field-input" type="time" name="scheduledTime" defaultValue={normalizeSlotTime(item.scheduled_time) ?? ""} />
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

      {makingImage && canMakeGraphic && (
        <CreativeStudioPanel itemId={item.id} aiAvailable={aiPhotosAvailable} hasGraphic={hasGraphic} />
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

      {showHistory && versions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg bg-ink-50 p-3">
          <p className="text-xs font-medium uppercase text-ink-400">Version history</p>
          {versions.map((v, i) => (
            <div key={v.id} className="rounded-lg border border-ink-100 bg-white p-2 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-ink-700">
                  v{v.version_number} · {VERSION_LABELS[v.generated_by] ?? v.generated_by}
                  {v.restored_from_version !== null && ` (from v${v.restored_from_version})`}
                </span>
                <span className="text-ink-400">{new Date(v.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-line text-ink-600">{v.caption || "(no caption)"}</p>
              {i > 0 && (
                <ActionForm action={restoreContentVersionAction} className="mt-1">
                  {(state) => (
                    <>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="versionNumber" value={v.version_number} />
                      <SubmitButton className="btn-secondary px-2 py-1 text-xs" pendingLabel="Restoring…">
                        Restore this version
                      </SubmitButton>
                      <FormError message={state.error} />
                    </>
                  )}
                </ActionForm>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
