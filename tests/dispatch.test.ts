import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/buffer/client", () => ({ createBufferPost: vi.fn() }));
vi.mock("@/lib/youtube/client", () => ({ uploadYoutubeVideo: vi.fn() }));
vi.mock("@/lib/google/oauth", () => ({ getValidAccessToken: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/automation/guard", () => ({ checkAutomationAllowed: vi.fn() }));

import { createBufferPost } from "@/lib/buffer/client";
import { checkAutomationAllowed } from "@/lib/automation/guard";
import { dispatchToPublisher, flushPendingPublishing } from "@/lib/publishing/dispatch";
import type { ContentItem } from "@/types/database";

const mockedBuffer = vi.mocked(createBufferPost);
const mockedGuard = vi.mocked(checkAutomationAllowed);

// A minimal stand-in for the Supabase client: records every update and answers
// the handful of reads dispatch makes.
function fakeSupabase(opts: {
  link?: { buffer_channel_id: string } | null;
  media?: { media_type: string; storage_path: string }[];
  items?: unknown[];
}) {
  const updates: { table: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    let isUpdate = false;
    const api: Record<string, unknown> = {};
    const chain = () => api;
    Object.assign(api, {
      select: chain,
      eq: chain,
      gte: chain,
      order: chain,
      limit: chain,
      update: (payload: Record<string, unknown>) => {
        isUpdate = true;
        updates.push({ table, payload });
        return api;
      },
      maybeSingle: async () => ({ data: table === "buffer_channel_links" ? (opts.link ?? null) : null }),
      then: (resolve: (v: unknown) => unknown) =>
        resolve(
          isUpdate
            ? { data: null, error: null }
            : table === "content_media"
              ? { data: opts.media ?? [], error: null }
              : table === "content_items"
                ? { data: opts.items ?? [], error: null }
                : { data: null, error: null }
        ),
    });
    return api;
  };
  const client = {
    from,
    storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed.example/${p}` } }) }) },
  } as unknown as SupabaseClient;
  return { client, updates };
}

const item = (over: Partial<ContentItem> = {}) =>
  ({
    id: "i1",
    org_id: "o1",
    platform: "facebook",
    scheduled_date: "2026-09-21",
    scheduled_time: "09:00:00", // exactly how the database returns a `time` column
    caption: "Hello from Aura Lux",
    hashtags: ["choc", "gift"],
    status: "scheduled",
    source: "ai_generated",
    created_by: "u1",
    publish_status: "not_sent",
    ...over,
  }) as unknown as ContentItem;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T02:00:00.000Z")); // 7:30 AM IST — the 9:00 AM slot is still ahead
  mockedBuffer.mockReset();
  mockedBuffer.mockResolvedValue({ id: "buffer-post-1", text: "", dueAt: null });
  mockedGuard.mockReset();
  mockedGuard.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.useRealTimers());

describe("dispatchToPublisher — Facebook/Instagram via Buffer", () => {
  it("sends a scheduled post to the linked channel at the correct UTC time and records it", async () => {
    const { client, updates } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    const result = await dispatchToPublisher(client, item());

    expect(result).toEqual({ outcome: "sent" });
    expect(mockedBuffer).toHaveBeenCalledOnce();
    expect(mockedBuffer.mock.calls[0][0]).toEqual({
      channelId: "chan-1",
      text: "Hello from Aura Lux\n\n#choc #gift",
      dueAt: "2026-09-21T03:30:00.000Z", // 9:00 AM IST, from a "09:00:00" database value
      assetUrls: [],
    });
    expect(updates.at(-1)?.payload).toMatchObject({ buffer_post_id: "buffer-post-1", publish_status: "sent", publish_error: null });
  });

  it("sends the evening slot at 12:30 UTC (6:00 PM IST)", async () => {
    const { client } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    await dispatchToPublisher(client, item({ scheduled_time: "18:00:00" }));
    expect(mockedBuffer.mock.calls[0][0].dueAt).toBe("2026-09-21T12:30:00.000Z");
  });

  it("attaches the post's media as signed URLs", async () => {
    const { client } = fakeSupabase({
      link: { buffer_channel_id: "chan-1" },
      media: [{ media_type: "image", storage_path: "o1/pic.jpg" }],
    });
    await dispatchToPublisher(client, item({ platform: "instagram" }));
    expect(mockedBuffer.mock.calls[0][0].assetUrls).toEqual([{ type: "image", url: "https://signed.example/o1/pic.jpg" }]);
  });

  it("does not send an Instagram post with no image or video, and says why", async () => {
    const { client, updates } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    const result = await dispatchToPublisher(client, item({ platform: "instagram" }));

    expect(result).toMatchObject({ outcome: "error" });
    expect(mockedBuffer).not.toHaveBeenCalled();
    expect(updates.at(-1)?.payload).toMatchObject({ publish_status: "error" });
    expect(String(updates.at(-1)?.payload.publish_error)).toContain("Instagram needs an image or video");
  });

  it("leaves the post alone (no error) when no channel is linked yet", async () => {
    const { client, updates } = fakeSupabase({ link: null });
    expect(await dispatchToPublisher(client, item())).toEqual({ outcome: "no_channel" });
    expect(mockedBuffer).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("refuses a slot whose time has already passed and records why", async () => {
    const { client, updates } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    const result = await dispatchToPublisher(client, item({ scheduled_date: "2026-09-20" }));

    expect(result).toEqual({ outcome: "past" });
    expect(mockedBuffer).not.toHaveBeenCalled();
    expect(String(updates.at(-1)?.payload.publish_error)).toContain("already passed");
  });

  it("silently skips a past item during a bulk flush instead of flagging it", async () => {
    const { client, updates } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    const result = await dispatchToPublisher(client, item({ scheduled_date: "2026-09-20" }), { skipIfPast: true });
    expect(result).toEqual({ outcome: "skipped" });
    expect(updates).toEqual([]);
  });

  it("does nothing while automation is paused (Master STOP / Emergency Freeze)", async () => {
    mockedGuard.mockResolvedValue({ allowed: false, reason: "Automation is paused" });
    const { client, updates } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    expect(await dispatchToPublisher(client, item())).toEqual({ outcome: "paused", message: "Automation is paused" });
    expect(mockedBuffer).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("records Buffer's rejection on the post instead of throwing", async () => {
    mockedBuffer.mockRejectedValue(new Error("Buffer API error: channel disconnected"));
    const { client, updates } = fakeSupabase({ link: { buffer_channel_id: "chan-1" } });
    const result = await dispatchToPublisher(client, item());

    expect(result).toEqual({ outcome: "error", message: "Buffer API error: channel disconnected" });
    expect(updates.at(-1)?.payload).toMatchObject({ publish_status: "error", publish_error: "Buffer API error: channel disconnected" });
  });
});

describe("flushPendingPublishing", () => {
  it("sends every still-scheduled, not-yet-sent post once a channel exists, skipping ones already past", async () => {
    const upcoming = item({ id: "a" });
    const later = item({ id: "b", scheduled_date: "2026-09-22", scheduled_time: "18:00:00" });
    const gone = item({ id: "c", scheduled_date: "2026-09-21", scheduled_time: "00:30:00" }); // 12:30 AM IST, already past
    const { client } = fakeSupabase({ link: { buffer_channel_id: "chan-1" }, items: [upcoming, later, gone] });

    const result = await flushPendingPublishing(client, "o1");
    expect(result).toEqual({ attempted: 3, sent: 2 });
    expect(mockedBuffer).toHaveBeenCalledTimes(2);
  });
});
