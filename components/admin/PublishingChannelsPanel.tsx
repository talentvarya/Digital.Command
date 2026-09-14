"use client";

import { Unplug } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { linkBufferChannelAction, unlinkBufferChannelAction } from "@/app/admin/clients/[orgId]/publishing-actions";
import type { BufferChannel } from "@/lib/buffer/client";
import type { BufferChannelLink, BufferPlatform } from "@/types/database";

const PLATFORM_LABELS: Record<BufferPlatform, string> = { facebook: "Facebook", instagram: "Instagram" };

export function PublishingChannelsPanel({
  orgId,
  links,
  bufferChannels,
  bufferError,
}: {
  orgId: string;
  links: BufferChannelLink[];
  bufferChannels: BufferChannel[];
  bufferError: string | null;
}) {
  const linkByPlatform = new Map(links.map((l) => [l.platform, l]));

  if (bufferError) {
    return <p className="text-sm text-red-600">Could not load Buffer channels: {bufferError}</p>;
  }

  return (
    <div className="space-y-3">
      {(["facebook", "instagram"] as BufferPlatform[]).map((platform) => {
        const link = linkByPlatform.get(platform);
        return (
          <div key={platform} className="rounded-lg border border-ink-100 p-3">
            <div className="mb-2 text-sm font-medium text-ink-800">{PLATFORM_LABELS[platform]}</div>
            {link ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-600">{link.buffer_channel_name ?? link.buffer_channel_id}</span>
                <ActionForm action={unlinkBufferChannelAction}>
                  {() => (
                    <>
                      <input type="hidden" name="id" value={link.id} />
                      <input type="hidden" name="orgId" value={orgId} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        <Unplug className="mr-1 inline h-3 w-3" /> Unlink
                      </button>
                    </>
                  )}
                </ActionForm>
              </div>
            ) : (
              <ActionForm action={linkBufferChannelAction} className="flex flex-wrap items-end gap-2">
                {(state) => (
                  <>
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="platform" value={platform} />
                    <select
                      name="bufferChannelId"
                      className="field-input flex-1"
                      defaultValue=""
                      required
                      onChange={(e) => {
                        const form = e.currentTarget.form;
                        const nameInput = form?.elements.namedItem("bufferChannelName") as HTMLInputElement | null;
                        if (nameInput) nameInput.value = e.currentTarget.selectedOptions[0]?.text ?? "";
                      }}
                    >
                      <option value="" disabled>
                        {bufferChannels.length ? "Select a Buffer channel…" : "No Buffer channels found"}
                      </option>
                      {bufferChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.service})
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="bufferChannelName" />
                    <SubmitButton className="btn-primary px-3 py-2 text-sm">Link</SubmitButton>
                    <FormError message={state.error} />
                  </>
                )}
              </ActionForm>
            )}
          </div>
        );
      })}
      <p className="text-xs text-ink-400">
        Channels must already be connected to the VMG Buffer account (buffer.com) before they show up here.
      </p>
    </div>
  );
}
