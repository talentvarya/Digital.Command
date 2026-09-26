import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A recording stand-in for the signed-in member's Supabase session. Each query is
// answered by `answer()` and remembered in `ops`, so the tests can check what was
// written and which filters were used.
interface Op {
  table: string;
  kind: "select" | "insert" | "update";
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
  filters: [string, ...unknown[]][];
}
let ops: Op[];
let controlMode: "approval_required" | "autopilot";
let existingPosts: { id: string }[];
let monthlyGenerations: number;

function answer(op: Op) {
  const { table, kind } = op;
  if (table === "organization_members") return { data: { org_id: "org-1" } };
  if (table === "content_versions" && kind === "select") return op.options?.head ? { count: monthlyGenerations } : { data: [] };
  if (table === "content_items" && kind === "select") return { data: existingPosts };
  if (table === "brand_profiles") return { data: { org_id: "org-1", business_description: "Handmade chocolates" } };
  if (table === "client_settings") return { data: { content_control_mode: controlMode } };
  if (table === "content_items" && kind === "insert") return { data: { id: "item-1", ...op.payload }, error: null };
  if (table === "content_media") return { count: 0 };
  return { data: null, error: null };
}

function from(table: string) {
  const op: Op = { table, kind: "select", filters: [] };
  ops.push(op);
  const api: Record<string, unknown> = {
    select: (_cols?: string, options?: Record<string, unknown>) => {
      if (op.kind === "select") op.options = options;
      return api;
    },
    insert: (payload: Record<string, unknown>) => ((op.kind = "insert"), (op.payload = payload), api),
    update: (payload: Record<string, unknown>) => ((op.kind = "update"), (op.payload = payload), api),
    eq: (c: string, v: unknown) => (op.filters.push(["eq", c, v]), api),
    gte: (c: string, v: unknown) => (op.filters.push(["gte", c, v]), api),
    lte: (c: string, v: unknown) => (op.filters.push(["lte", c, v]), api),
    in: (c: string, v: unknown) => (op.filters.push(["in", c, v]), api),
    not: (c: string, operator: string, v: unknown) => (op.filters.push(["not", c, operator, v]), api),
    is: (c: string, v: unknown) => (op.filters.push(["is", c, v]), api),
    order: () => api,
    limit: () => api,
    single: async () => answer(op),
    maybeSingle: async () => answer(op),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(answer(op)).then(resolve, reject),
  };
  return api;
}

const generateCaption = vi.fn();
const dispatchToPublisher = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) }, from }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: async () => undefined }));
vi.mock("@/lib/automation/guard", () => ({
  checkAutomationAllowed: async () => ({ allowed: true }),
  isEmergencyFrozen: async () => false,
}));
vi.mock("@/lib/ai/log-usage", () => ({ logAiUsage: async () => undefined }));
vi.mock("@/lib/ai/generate-content", () => ({
  generateCaption: (params: unknown) => generateCaption(params),
  findAvoidedWords: () => [],
  AiGenerationError: class AiGenerationError extends Error {},
}));
vi.mock("@/lib/publishing/dispatch", () => ({ dispatchToPublisher: (...args: unknown[]) => dispatchToPublisher(...args) }));
vi.mock("@/lib/unsplash/attach", () => ({ attachUnsplashPhoto: async () => undefined, captionToImageQuery: () => "q" }));

import { planOccasionPostAction } from "@/app/app/planner/actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const inserts = () => ops.filter((o) => o.table === "content_items" && o.kind === "insert");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T05:00:00Z")); // 10:30 IST, twelve days before Diwali
  ops = [];
  controlMode = "approval_required";
  existingPosts = [];
  monthlyGenerations = 0;
  generateCaption.mockReset();
  generateCaption.mockResolvedValue({ caption: "Happy Diwali from all of us!", hashtags: ["diwali"], imageIdea: "Diyas on a table", usage: {} });
  dispatchToPublisher.mockReset();
  revalidatePath.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("planOccasionPostAction", () => {
  it("writes a draft for the festival, on its day, and tells the AI what the post is for", async () => {
    const result = await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "instagram" }));
    expect(result).toEqual({ message: "An Instagram post for Diwali is ready — it's waiting for your approval in the planner below." });

    expect(generateCaption).toHaveBeenCalledTimes(1);
    expect(generateCaption.mock.calls[0][0]).toMatchObject({
      platform: "instagram",
      occasion: { name: "Diwali", date: "2026-11-08", angle: expect.stringContaining("festival of lights") },
    });

    const [insert] = inserts();
    expect(insert.payload).toMatchObject({
      org_id: "org-1",
      platform: "instagram",
      scheduled_date: "2026-11-08",
      scheduled_time: "09:00",
      status: "waiting_approval",
      caption: "Happy Diwali from all of us!",
    });
    expect(dispatchToPublisher).not.toHaveBeenCalled(); // waiting for approval: nothing is sent
    expect(revalidatePath).toHaveBeenCalledWith("/app/planner");
  });

  it("schedules it, and says so, for a business on Autopilot", async () => {
    controlMode = "autopilot";
    const result = await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "facebook" }));
    expect(result.message).toMatch(/it's scheduled\.$/);
    expect(inserts()[0].payload).toMatchObject({ status: "scheduled", platform: "facebook" });
    expect(dispatchToPublisher).toHaveBeenCalledTimes(1);
  });

  it("only takes an occasion that exists, and only Facebook or Instagram", async () => {
    expect(await planOccasionPostAction({}, form({ occasionKey: "made-up", platform: "instagram" }))).toEqual({ error: "That occasion wasn't found." });
    expect(await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "youtube" }))).toEqual({ error: "Choose Facebook or Instagram." });
    expect(await planOccasionPostAction({}, form({ occasionKey: "diwali-2026" }))).toEqual({ error: "Choose Facebook or Instagram." });
    expect(generateCaption).not.toHaveBeenCalled();
  });

  it("refuses an occasion that has already passed", async () => {
    vi.setSystemTime(new Date("2026-11-09T05:00:00Z"));
    expect(await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "instagram" }))).toEqual({ error: "Diwali has already passed." });
    expect(generateCaption).not.toHaveBeenCalled();
  });

  it("uses the evening slot when the morning one has gone, and stops when both have", async () => {
    vi.setSystemTime(new Date("2026-11-08T06:00:00Z")); // 11:30 IST on Diwali: 9:00 AM has gone
    await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "instagram" }));
    expect(inserts()[0].payload).toMatchObject({ scheduled_time: "18:00" });

    ops = [];
    generateCaption.mockClear();
    vi.setSystemTime(new Date("2026-11-08T13:00:00Z")); // 18:30 IST: both have gone
    const result = await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "instagram" }));
    expect(result.error).toMatch(/Today's posting times have already passed/);
    expect(generateCaption).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it("won't add a second post for the same festival on the same platform", async () => {
    existingPosts = [{ id: "already" }];
    const result = await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "instagram" }));
    expect(result.error).toBe("You already have an Instagram post planned for Diwali — open it in the planner below.");
    expect(generateCaption).not.toHaveBeenCalled();

    // the check looks at this business, this platform and this day, and ignores dead posts
    const lookup = ops.find((o) => o.table === "content_items" && o.kind === "select")!;
    expect(lookup.filters).toEqual(
      expect.arrayContaining([
        ["eq", "org_id", "org-1"],
        ["eq", "platform", "instagram"],
        ["eq", "scheduled_date", "2026-11-08"],
        ["not", "status", "in", "(rejected,skipped)"],
      ])
    );
  });

  it("stops at the monthly AI safety cap, like every other way of writing a post", async () => {
    monthlyGenerations = 60;
    const result = await planOccasionPostAction({}, form({ occasionKey: "diwali-2026", platform: "instagram" }));
    expect(result.error).toMatch(/Monthly AI generation limit reached \(60\)/);
    expect(generateCaption).not.toHaveBeenCalled();
  });
});
