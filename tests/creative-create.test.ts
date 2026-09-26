import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCreative, type CreateCreativeInput, type CreativeDeps } from "@/lib/creative/create";
import { CloudflareImageError } from "@/lib/creative/cloudflare";
import { AI_PHOTO_DAILY_LIMIT_PER_ORG } from "@/lib/creative/quota";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const RENDERED = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]);

interface World {
  item?: Record<string, unknown> | null;
  brand?: Record<string, unknown> | null;
  media?: { id: string; storage_path: string }[];
  stillUsed?: { storage_path: string }[]; // other posts still pointing at a replaced file (e.g. a copy)
  uploadError?: string;
  attachError?: string;
  logoBytes?: Uint8Array | null;
}

// The member's own session client: reads the post and brand, stores the file, attaches it.
function fakeMember(world: World) {
  let mediaReads = 0;
  const calls = {
    uploads: [] as string[],
    removed: [] as string[],
    insertedMedia: [] as Record<string, unknown>[],
    deletedIds: [] as string[],
    updatedItems: [] as Record<string, unknown>[],
  };
  const item = world.item === undefined
    ? { id: "item-1", platform: "instagram", caption: "Flat 20% off on gift boxes. Order before Sunday.", status: "draft", locked: false, publish_status: "not_sent", scheduled_date: "2026-09-27", scheduled_time: "09:00:00" }
    : world.item;
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        update: (payload: Record<string, unknown>) => {
          if (table === "content_items") calls.updatedItems.push(payload);
          return builder;
        },
        maybeSingle: async () => ({
          data: table === "content_items" ? item : table === "brand_profiles" ? (world.brand ?? { colors: ["#5c3317"], logo_path: null, whatsapp: "+91 85888 38594", phone: null }) : { legal_name: "Aura Lux Chocolate Co." },
        }),
        insert: async (row: Record<string, unknown>) => {
          calls.insertedMedia.push(row);
          return { error: world.attachError ? { message: world.attachError } : null };
        },
        delete: () => ({
          in: async (_col: string, ids: string[]) => {
            calls.deletedIds.push(...ids);
            return { error: null };
          },
        }),
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            table === "content_media"
              ? { data: mediaReads++ === 0 ? (world.media ?? []) : (world.stillUsed ?? []), error: null }
              : { data: null, error: null }
          ),
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          if (bucket === "content-media") calls.uploads.push(path);
          return { error: world.uploadError ? { message: world.uploadError } : null };
        },
        remove: async (paths: string[]) => {
          calls.removed.push(...paths);
          return { error: null };
        },
        download: async () => ({ data: world.logoBytes ? new Blob([world.logoBytes as unknown as BlobPart]) : null }),
      }),
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

// The service-role client: shared usage counts and the usage log.
function fakeService(counts = { org: 0, platform: 0 }) {
  const inserts: Record<string, unknown>[] = [];
  const client = {
    from: () => {
      let orgFilter = false;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string) => {
          if (col === "org_id") orgFilter = true;
          return builder;
        },
        gte: () => builder,
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { error: null };
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ count: orgFilter ? counts.org : counts.platform, error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, inserts };
}

let deps: CreativeDeps;
beforeEach(() => {
  deps = {
    aiConfigured: vi.fn(() => true),
    generateAiImage: vi.fn(async () => JPEG),
    findStockPhoto: vi.fn(async () => JPEG),
    render: vi.fn(async () => RENDERED),
    now: () => new Date("2026-09-26T10:00:00Z"),
  };
});

const input = (over: Partial<CreateCreativeInput> = {}): CreateCreativeInput => ({
  orgId: "org-1",
  userId: "user-1",
  contentItemId: "item-1",
  style: "auto",
  background: "auto",
  size: "auto",
  ...over,
});

describe("createCreative — refusing", () => {
  it.each([
    [{ platform: "youtube" }, /Facebook and Instagram/],
    [{ locked: true }, /locked/],
    [{ status: "published" }, /finished/],
    [{ publish_status: "sent" }, /already been sent/],
  ])("won't touch a post that is blocked (%o)", async (patch, message) => {
    const member = fakeMember({ item: { id: "item-1", platform: "instagram", caption: "x", status: "draft", locked: false, publish_status: "not_sent", scheduled_date: "d", scheduled_time: null, ...patch } });
    const result = await createCreative(member.client, fakeService().client, input(), deps);
    expect(result).toMatchObject({ error: expect.stringMatching(message) });
    expect(deps.render).not.toHaveBeenCalled();
    expect(member.calls.uploads).toEqual([]);
  });

  it("says so when the post doesn't exist for this business", async () => {
    const member = fakeMember({ item: null });
    expect(await createCreative(member.client, fakeService().client, input(), deps)).toEqual({ error: "Post not found." });
  });
});

describe("createCreative — backgrounds", () => {
  it("auto: uses a free AI photo when it is available, counts it, and draws the graphic on it", async () => {
    const member = fakeMember({});
    const service = fakeService();
    const result = await createCreative(member.client, service.client, input(), deps);

    expect(result).toEqual({ ok: true, background: "ai", style: "offer" });
    expect(deps.generateAiImage).toHaveBeenCalledOnce();
    expect(deps.findStockPhoto).not.toHaveBeenCalled();
    expect(service.inserts).toEqual([
      expect.objectContaining({ org_id: "org-1", kind: "ai_photo", provider: "cloudflare-flux", style: "offer" }),
    ]);
    const spec = vi.mocked(deps.render).mock.calls[0][0];
    expect(spec.backgroundDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(spec.style).toBe("offer"); // "20% off" in the caption
    expect(spec.contact).toBe("WhatsApp +91 85888 38594");
    expect([spec.width, spec.height]).toEqual([1080, 1350]); // Instagram
  });

  it("auto: falls back to a stock photo when AI photos aren't switched on", async () => {
    vi.mocked(deps.aiConfigured).mockReturnValue(false);
    const service = fakeService();
    const result = await createCreative(fakeMember({}).client, service.client, input(), deps);
    expect(result).toMatchObject({ ok: true, background: "stock" });
    expect(deps.generateAiImage).not.toHaveBeenCalled();
    expect(service.inserts).toEqual([expect.objectContaining({ kind: "template", provider: "satori" })]);
  });

  it("auto: falls back to a stock photo when today's AI allowance is used up", async () => {
    const service = fakeService({ org: AI_PHOTO_DAILY_LIMIT_PER_ORG, platform: 10 });
    const result = await createCreative(fakeMember({}).client, service.client, input(), deps);
    expect(result).toMatchObject({ ok: true, background: "stock" });
    expect(deps.generateAiImage).not.toHaveBeenCalled();
  });

  it("auto: falls back to stock, then brand colours, when the AI call fails and no stock photo exists", async () => {
    vi.mocked(deps.generateAiImage).mockRejectedValue(new CloudflareImageError("boom"));
    vi.mocked(deps.findStockPhoto).mockResolvedValue(null);
    const service = fakeService();
    const result = await createCreative(fakeMember({}).client, service.client, input(), deps);
    expect(result).toMatchObject({ ok: true, background: "colors" });
    expect(vi.mocked(deps.render).mock.calls[0][0].backgroundDataUrl).toBeNull();
    expect(service.inserts).toEqual([expect.objectContaining({ kind: "template" })]); // a failed AI call spent nothing
  });

  it("explicit AI photo: reports why it can't be made instead of quietly substituting", async () => {
    vi.mocked(deps.aiConfigured).mockReturnValue(false);
    expect(await createCreative(fakeMember({}).client, fakeService().client, input({ background: "ai" }), deps)).toMatchObject({
      error: expect.stringMatching(/aren't switched on/),
    });

    vi.mocked(deps.aiConfigured).mockReturnValue(true);
    const described = { background: "ai" as const, imagePrompt: "a bar of dark chocolate on slate" };
    const full = fakeService({ org: AI_PHOTO_DAILY_LIMIT_PER_ORG, platform: 0 });
    expect(await createCreative(fakeMember({}).client, full.client, input(described), deps)).toMatchObject({
      error: expect.stringMatching(/5:30 AM IST/),
    });

    vi.mocked(deps.generateAiImage).mockRejectedValue(new CloudflareImageError("The free AI photo allowance for today is used up.", "quota"));
    expect(await createCreative(fakeMember({}).client, fakeService().client, input(described), deps)).toEqual({
      error: "The free AI photo allowance for today is used up.",
    });
    expect(deps.render).not.toHaveBeenCalled();
  });

  it("explicit stock photo: reports a missing photo or an unavailable service", async () => {
    vi.mocked(deps.findStockPhoto).mockResolvedValue(null);
    expect(await createCreative(fakeMember({}).client, fakeService().client, input({ background: "stock" }), deps)).toMatchObject({
      error: expect.stringMatching(/No matching stock photo/),
    });
    vi.mocked(deps.findStockPhoto).mockRejectedValue(new Error("Photo search is not configured — UNSPLASH_ACCESS_KEY is missing."));
    const result = await createCreative(fakeMember({}).client, fakeService().client, input({ background: "stock" }), deps);
    expect(result).toMatchObject({ error: expect.stringMatching(/aren't available right now/) });
    expect(JSON.stringify(result)).not.toContain("UNSPLASH_ACCESS_KEY"); // no internals shown to a client
  });

  it("brand colours: never calls out to a photo service", async () => {
    const service = fakeService();
    const result = await createCreative(fakeMember({}).client, service.client, input({ background: "colors" }), deps);
    expect(result).toMatchObject({ ok: true, background: "colors" });
    expect(deps.generateAiImage).not.toHaveBeenCalled();
    expect(deps.findStockPhoto).not.toHaveBeenCalled();
  });

  it("uses colours when the photo is in a format the renderer can't draw", async () => {
    vi.mocked(deps.findStockPhoto).mockResolvedValue(new TextEncoder().encode("RIFFxxxxWEBPVP8 "));
    const result = await createCreative(fakeMember({}).client, fakeService().client, input({ background: "stock" }), deps);
    expect(result).toMatchObject({ ok: true, background: "colors" });
  });
});

describe("createCreative — the picture description", () => {
  const post = (extra: Record<string, unknown> = {}) => ({
    id: "item-1",
    platform: "facebook",
    caption: "Meet our new hazelnut bar. Small-batch and fresh.",
    status: "draft",
    locked: false,
    publish_status: "not_sent",
    scheduled_date: "d",
    scheduled_time: null,
    ...extra,
  });

  it("makes the AI photo from what the client described, and saves the description on the post", async () => {
    const member = fakeMember({ item: post() });
    await createCreative(member.client, fakeService().client, input({ background: "ai", imagePrompt: "  Hazelnut bar\non a marble slab, moody light " }), deps);

    const prompt = vi.mocked(deps.generateAiImage).mock.calls[0][0];
    expect(prompt).toContain("The picture should show: Hazelnut bar on a marble slab, moody light.");
    expect(member.calls.updatedItems).toEqual([{ image_prompt: "Hazelnut bar on a marble slab, moody light" }]);
  });

  it("refuses an explicit AI photo when nothing has been described", async () => {
    const member = fakeMember({ item: post() });
    const result = await createCreative(member.client, fakeService().client, input({ background: "ai" }), deps);
    expect(result).toMatchObject({ error: expect.stringMatching(/Describe the picture you want first/) });
    expect(deps.generateAiImage).not.toHaveBeenCalled();
    expect(member.calls.uploads).toEqual([]);
  });

  it("uses the description already saved on the post (e.g. the AI's suggestion) when none is typed", async () => {
    const member = fakeMember({ item: post({ image_prompt: "A slab of chocolate with hazelnuts scattered around" }) });
    const result = await createCreative(member.client, fakeService().client, input({ background: "ai" }), deps);
    expect(result).toMatchObject({ ok: true, background: "ai" });
    expect(vi.mocked(deps.generateAiImage).mock.calls[0][0]).toContain("A slab of chocolate with hazelnuts scattered around");
    expect(member.calls.updatedItems).toEqual([]); // nothing new to save
  });

  it("lets the client clear a saved description, falling back to the post's own words", async () => {
    const member = fakeMember({ item: post({ image_prompt: "old idea" }) });
    await createCreative(member.client, fakeService().client, input({ background: "auto", imagePrompt: "" }), deps);
    expect(vi.mocked(deps.generateAiImage).mock.calls[0][0]).not.toContain("old idea");
    expect(vi.mocked(deps.generateAiImage).mock.calls[0][0]).toContain("The post is about:");
    expect(member.calls.updatedItems).toEqual([{ image_prompt: null }]);
  });

  it("searches stock photos using the description", async () => {
    const member = fakeMember({ item: post() });
    await createCreative(member.client, fakeService().client, input({ background: "stock", imagePrompt: "warm chocolate gift box on wooden table" }), deps);
    expect(deps.findStockPhoto).toHaveBeenCalledWith("warm chocolate gift box on wooden");
  });

  it("puts the client's own words on the graphic when they changed them", async () => {
    const member = fakeMember({ item: post() });
    await createCreative(
      member.client,
      fakeService().client,
      input({ background: "colors", headline: "New: Hazelnut Praline Bar 🍫 #new", subline: "" }),
      deps
    );
    const spec = vi.mocked(deps.render).mock.calls[0][0];
    expect(spec.headline).toBe("New: Hazelnut Praline Bar");
    expect(spec.subline).toBeNull(); // an emptied second line means none
  });

  it("uses the caption's words for anything the client didn't send", async () => {
    const member = fakeMember({ item: post() });
    await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);
    const spec = vi.mocked(deps.render).mock.calls[0][0];
    expect(spec.headline).toBe("Meet our new hazelnut bar");
    expect(spec.subline).toBe("Small-batch and fresh.");
  });
});

describe("createCreative — saving", () => {
  it("stores the graphic, attaches it, and swaps out only the pictures it replaces", async () => {
    const member = fakeMember({
      media: [
        { id: "m-stock", storage_path: "org-1/a-unsplash.jpg" },
        { id: "m-old", storage_path: "org-1/b-creative.jpg" },
        { id: "m-own", storage_path: "org-1/c-my-shop.jpg" },
      ],
    });
    const result = await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);

    expect(result).toMatchObject({ ok: true });
    expect(member.calls.uploads).toHaveLength(1);
    expect(member.calls.uploads[0]).toMatch(/^org-1\/[0-9a-f-]+-creative\.jpg$/);
    expect(member.calls.insertedMedia).toEqual([
      { content_item_id: "item-1", org_id: "org-1", media_type: "image", storage_path: member.calls.uploads[0] },
    ]);
    expect(member.calls.deletedIds.sort()).toEqual(["m-old", "m-stock"]); // the client's own photo is untouched
    expect(member.calls.removed.sort()).toEqual(["org-1/a-unsplash.jpg", "org-1/b-creative.jpg"]);
  });

  it("keeps a replaced file that another post still uses (a copied post shares the same stored file)", async () => {
    const member = fakeMember({
      media: [
        { id: "m-shared", storage_path: "org-1/shared-creative.jpg" },
        { id: "m-alone", storage_path: "org-1/alone-unsplash.jpg" },
      ],
      stillUsed: [{ storage_path: "org-1/shared-creative.jpg" }],
    });
    const result = await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);

    expect(result).toMatchObject({ ok: true });
    expect(member.calls.deletedIds.sort()).toEqual(["m-alone", "m-shared"]); // this post lets go of both...
    expect(member.calls.removed).toEqual(["org-1/alone-unsplash.jpg"]); // ...but only the file nobody else uses is deleted
  });

  it("uses the client's logo when Brand Brain has one", async () => {
    const member = fakeMember({ brand: { colors: ["#111"], logo_path: "org-1/logo.png", whatsapp: null, phone: "98765 43210" }, logoBytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1]) });
    await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);
    const spec = vi.mocked(deps.render).mock.calls[0][0];
    expect(spec.logoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(spec.contact).toBe("Call 98765 43210");
  });

  it("only puts a contact line on offer graphics", async () => {
    const member = fakeMember({ item: { id: "item-1", platform: "facebook", caption: "Meet our new hazelnut bar", status: "draft", locked: false, publish_status: "not_sent", scheduled_date: "d", scheduled_time: null } });
    await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);
    const spec = vi.mocked(deps.render).mock.calls[0][0];
    expect(spec.style).toBe("spotlight");
    expect(spec.contact).toBeNull();
    expect([spec.width, spec.height]).toEqual([1080, 1080]); // Facebook: square
  });

  it("keeps the old picture and reports a friendly error when drawing fails", async () => {
    vi.mocked(deps.render).mockRejectedValue(new Error("satori exploded"));
    const member = fakeMember({ media: [{ id: "m-old", storage_path: "org-1/b-creative.jpg" }] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);
    spy.mockRestore();
    expect(result).toMatchObject({ error: expect.stringMatching(/could not be drawn/) });
    expect(member.calls.uploads).toEqual([]);
    expect(member.calls.deletedIds).toEqual([]);
  });

  it("reports an upload failure without touching the old picture", async () => {
    const member = fakeMember({ uploadError: "bucket full", media: [{ id: "m-old", storage_path: "org-1/b-creative.jpg" }] });
    const result = await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);
    expect(result).toEqual({ error: "Could not save the graphic: bucket full" });
    expect(member.calls.deletedIds).toEqual([]);
  });

  it("cleans up the uploaded file if attaching it to the post fails", async () => {
    const member = fakeMember({ attachError: "row-level security" });
    const result = await createCreative(member.client, fakeService().client, input({ background: "colors" }), deps);
    expect(result).toMatchObject({ error: expect.stringMatching(/Could not attach/) });
    expect(member.calls.removed).toEqual(member.calls.uploads);
  });
});
