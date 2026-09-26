import { describe, expect, it } from "vitest";
import {
  addDays,
  buildAttentionItems,
  comparableSeries,
  countInWindows,
  daysUntil,
  deriveAttentionInput,
  describeActivity,
  formatPercent,
  formatSlot,
  greetingFor,
  istDateString,
  percentChange,
  pickApprovalQueue,
  sparklinePath,
  spanDays,
  timeAgo,
  type AttentionInput,
  type UpcomingItem,
} from "@/lib/dashboard/command-center";

const quiet: AttentionInput = {
  waitingApproval: 0,
  publishErrors: 0,
  postsWithoutImage: 0,
  reviewsNeedingReply: 0,
  connectionsToFix: 0,
  noPublishingChannel: false,
  brandIncomplete: false,
  daysUntilExpiry: null,
  occasionNudge: null,
};

describe("greetingFor", () => {
  it("follows the hour in India, not the server's clock", () => {
    expect(greetingFor(new Date("2026-09-26T03:30:00Z"))).toBe("Good morning"); // 9:00 IST
    expect(greetingFor(new Date("2026-09-26T08:00:00Z"))).toBe("Good afternoon"); // 13:30 IST
    expect(greetingFor(new Date("2026-09-26T13:00:00Z"))).toBe("Good evening"); // 18:30 IST
    expect(greetingFor(new Date("2026-09-26T19:00:00Z"))).toBe("Hello"); // 00:30 IST
  });
});

describe("istDateString", () => {
  it("is the calendar date in India, which runs ahead of UTC", () => {
    expect(istDateString(new Date("2026-09-26T03:30:00Z"))).toBe("2026-09-26");
    // 19:00 UTC on the 26th is already 00:30 on the 27th in India.
    expect(istDateString(new Date("2026-09-26T19:00:00Z"))).toBe("2026-09-27");
    // ...and 18:29 UTC is still 23:59 on the 26th.
    expect(istDateString(new Date("2026-09-26T18:29:00Z"))).toBe("2026-09-26");
  });
});

describe("addDays", () => {
  it("moves a date across month and year ends", () => {
    expect(addDays("2026-09-26", 5)).toBe("2026-10-01");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-09-26", 0)).toBe("2026-09-26");
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-09-26T08:00:00Z"); // 26 Sep, 13:30 IST

  it("counts calendar days in India", () => {
    expect(daysUntil("2026-09-26", now)).toBe(0);
    expect(daysUntil("2026-09-27", now)).toBe(1);
    expect(daysUntil("2026-10-26", now)).toBe(30);
  });

  it("goes negative once the expiry day has passed", () => {
    expect(daysUntil("2026-09-25", now)).toBe(-1);
    // 00:30 IST on the 27th: the 26th has just ended.
    expect(daysUntil("2026-09-26", new Date("2026-09-26T19:00:00Z"))).toBe(-1);
  });

  it("has no answer without a usable date", () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("not a date", now)).toBeNull();
  });
});

describe("percentChange / formatPercent", () => {
  it("compares against the previous value", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("has nothing to say without a usable previous value", () => {
    expect(percentChange(10, null)).toBeNull();
    expect(percentChange(10, 0)).toBeNull();
    expect(formatPercent(null)).toBeNull();
  });

  it("formats gains, losses and flat readings", () => {
    expect(formatPercent(20)).toBe("+20%");
    expect(formatPercent(-4.26)).toBe("−4.3%");
    expect(formatPercent(0.2)).toBe("no change");
    expect(formatPercent(-0.4)).toBe("no change");
  });
});

describe("buildAttentionItems", () => {
  it("says nothing when everything is fine", () => {
    expect(buildAttentionItems(quiet)).toEqual([]);
  });

  it("puts problems before to-dos, and to-dos before tips", () => {
    const items = buildAttentionItems({
      ...quiet,
      waitingApproval: 3,
      publishErrors: 1,
      brandIncomplete: true,
      reviewsNeedingReply: 2,
    });
    expect(items.map((i) => i.key)).toEqual(["publish_errors", "approvals", "reviews", "brand"]);
    expect(items.map((i) => i.tone)).toEqual(["urgent", "todo", "todo", "info"]);
  });

  it("gets the singular and plural right", () => {
    expect(buildAttentionItems({ ...quiet, waitingApproval: 1 })[0].title).toBe("1 post is waiting for your approval");
    expect(buildAttentionItems({ ...quiet, waitingApproval: 4 })[0].title).toBe("4 posts are waiting for your approval");
    expect(buildAttentionItems({ ...quiet, postsWithoutImage: 1 })[0].title).toBe("1 upcoming post has no graphic yet");
    expect(buildAttentionItems({ ...quiet, postsWithoutImage: 6 })[0].title).toBe("6 upcoming posts have no graphic yet");
    expect(buildAttentionItems({ ...quiet, reviewsNeedingReply: 1 })[0].title).toBe("1 review needs a reply");
    expect(buildAttentionItems({ ...quiet, connectionsToFix: 2 })[0].title).toBe("2 Google connections need reconnecting");
    expect(buildAttentionItems({ ...quiet, connectionsToFix: 1 })[0].title).toBe("1 Google connection needs reconnecting");
    expect(buildAttentionItems({ ...quiet, publishErrors: 1 })[0].title).toBe("1 post couldn't be sent");
    expect(buildAttentionItems({ ...quiet, publishErrors: 3 })[0].title).toBe("3 posts couldn't be sent");
  });

  it("sends each item to the page that fixes it", () => {
    const byKey = Object.fromEntries(
      buildAttentionItems({ ...quiet, waitingApproval: 1, publishErrors: 1, postsWithoutImage: 1, reviewsNeedingReply: 1, connectionsToFix: 1, brandIncomplete: true }).map((i) => [i.key, i.href])
    );
    expect(byKey).toMatchObject({
      approvals: "/app/planner",
      publish_errors: "/app/planner",
      images: "/app/planner",
      reviews: "/app/reputation",
      connections: "/app/health",
      brand: "/app/brand",
    });
  });

  it("warns about an ending package, more urgently in the last week", () => {
    expect(buildAttentionItems({ ...quiet, daysUntilExpiry: 30 })).toEqual([]);
    const soon = buildAttentionItems({ ...quiet, daysUntilExpiry: 10 })[0];
    expect([soon.tone, soon.title]).toEqual(["todo", "Your package ends in 10 days"]);
    const oneDay = buildAttentionItems({ ...quiet, daysUntilExpiry: 1 })[0];
    expect([oneDay.tone, oneDay.title]).toEqual(["urgent", "Your package ends in 1 day"]);
    expect(buildAttentionItems({ ...quiet, daysUntilExpiry: 0 })[0].title).toBe("Your package ends today");
    expect(buildAttentionItems({ ...quiet, daysUntilExpiry: -3 })[0].title).toBe("Your package has expired");
  });

  it("nudges about a coming festival with no post planned, urgently only when it's close", () => {
    const near = buildAttentionItems({ ...quiet, occasionNudge: { name: "Diwali", days: 5 } })[0];
    expect([near.key, near.tone, near.title, near.href, near.cta]).toEqual([
      "occasion",
      "todo",
      "Diwali is in 5 days — no post planned yet",
      "/app/planner",
      "Plan a post",
    ]);
    expect(buildAttentionItems({ ...quiet, occasionNudge: { name: "Holi", days: 12 } })[0].tone).toBe("info");
    expect(buildAttentionItems({ ...quiet, occasionNudge: { name: "Holi", days: 1 } })[0].title).toBe("Holi is tomorrow — no post planned yet");
    expect(buildAttentionItems({ ...quiet, occasionNudge: null })).toEqual([]);
  });

  it("passes the festival nudge through from what the page found", () => {
    const withNudge = deriveAttentionInput({
      items: [],
      linkedPlatforms: [],
      googleStatuses: [],
      reviews: [],
      brand: { logo_path: "x", colors: ["#000000"] },
      daysUntilExpiry: null,
      occasionNudge: { name: "Diwali", days: 4 },
    });
    expect(withNudge.occasionNudge).toEqual({ name: "Diwali", days: 4 });
  });

  it("flags a missing publishing channel as urgent", () => {
    const item = buildAttentionItems({ ...quiet, noPublishingChannel: true })[0];
    expect(item.tone).toBe("urgent");
    expect(item.title).toMatch(/No publishing channel/);
  });
});

describe("deriveAttentionInput", () => {
  const post = (over: Partial<UpcomingItem> = {}): UpcomingItem => ({
    id: "p1",
    platform: "instagram",
    status: "scheduled",
    locked: false,
    publish_status: "not_sent",
    scheduled_date: "2026-09-27",
    scheduled_time: "09:00:00",
    caption: "Fresh batch today",
    content_media: [{ storage_path: "org/abc-creative.jpg" }],
    ...over,
  });
  const base = {
    items: [] as UpcomingItem[],
    linkedPlatforms: ["facebook", "instagram"],
    googleStatuses: [] as string[],
    reviews: [] as { reply_status: string }[],
    brand: { logo_path: "org/logo.png", colors: ["#123456"] } as { logo_path?: string | null; colors?: unknown } | null,
    daysUntilExpiry: null as number | null,
  };

  it("finds nothing to do for a healthy account", () => {
    expect(deriveAttentionInput({ ...base, items: [post()] })).toEqual({
      waitingApproval: 0,
      publishErrors: 0,
      postsWithoutImage: 0,
      reviewsNeedingReply: 0,
      connectionsToFix: 0,
      noPublishingChannel: false,
      brandIncomplete: false,
      daysUntilExpiry: null,
      occasionNudge: null,
    });
  });

  it("counts posts waiting for approval and posts that failed to send", () => {
    const input = deriveAttentionInput({
      ...base,
      items: [post({ id: "a", status: "waiting_approval" }), post({ id: "b", status: "waiting_approval" }), post({ id: "c", publish_status: "error" })],
    });
    expect([input.waitingApproval, input.publishErrors]).toEqual([2, 1]);
  });

  it("counts posts that still need a graphic, but not YouTube, locked, or already-imaged ones", () => {
    const input = deriveAttentionInput({
      ...base,
      items: [
        post({ id: "none", content_media: [] }),
        post({ id: "stock", content_media: [{ storage_path: "org/abc-unsplash.jpg" }] }), // only the auto stock photo → still needs one
        post({ id: "own", content_media: [{ storage_path: "org/upload.jpg" }] }), // the client's own picture
        post({ id: "yt", platform: "youtube", content_media: [] }),
        post({ id: "locked", locked: true, content_media: [] }),
        post({ id: "unset", content_media: undefined }),
      ],
    });
    expect(input.postsWithoutImage).toBe(3); // none, stock, unset
  });

  it("flags a missing publishing channel only for posts that will be sent through one", () => {
    const facebookOnly = { ...base, linkedPlatforms: ["facebook"] };
    expect(deriveAttentionInput({ ...facebookOnly, items: [post({ platform: "instagram" })] }).noPublishingChannel).toBe(true);
    expect(deriveAttentionInput({ ...facebookOnly, items: [post({ platform: "facebook" })] }).noPublishingChannel).toBe(false);
    // YouTube uploads through the client's own Google connection, not a Buffer channel.
    expect(deriveAttentionInput({ ...facebookOnly, items: [post({ platform: "youtube" })] }).noPublishingChannel).toBe(false);
    // A post that's finished or rejected isn't waiting on a channel.
    expect(deriveAttentionInput({ ...facebookOnly, items: [post({ platform: "instagram", status: "rejected" })] }).noPublishingChannel).toBe(false);
    expect(deriveAttentionInput({ ...base, linkedPlatforms: [], items: [] }).noPublishingChannel).toBe(false);
  });

  it("counts reviews that still need a reply and connections that need fixing", () => {
    const input = deriveAttentionInput({
      ...base,
      reviews: [{ reply_status: "needs_reply" }, { reply_status: "drafted" }, { reply_status: "posted" }, { reply_status: "needs_reply" }],
      googleStatuses: ["connected", "reconnect_required", "error", "not_added"],
    });
    expect([input.reviewsNeedingReply, input.connectionsToFix]).toEqual([2, 2]);
  });

  it("calls the brand incomplete without a logo or colours", () => {
    expect(deriveAttentionInput({ ...base, brand: null }).brandIncomplete).toBe(true);
    expect(deriveAttentionInput({ ...base, brand: { logo_path: null, colors: ["#123456"] } }).brandIncomplete).toBe(true);
    expect(deriveAttentionInput({ ...base, brand: { logo_path: "org/logo.png", colors: [] } }).brandIncomplete).toBe(true);
    expect(deriveAttentionInput({ ...base, brand: { logo_path: "org/logo.png", colors: null } }).brandIncomplete).toBe(true);
    expect(deriveAttentionInput({ ...base }).brandIncomplete).toBe(false);
  });

  it("passes the expiry through", () => {
    expect(deriveAttentionInput({ ...base, daysUntilExpiry: 5 }).daysUntilExpiry).toBe(5);
  });
});

describe("pickApprovalQueue", () => {
  const p = (id: string, date: string, time: string | null, status = "waiting_approval"): UpcomingItem => ({
    id,
    platform: "facebook",
    status,
    locked: false,
    publish_status: "not_sent",
    scheduled_date: date,
    scheduled_time: time,
    caption: id,
  });

  it("lists only posts waiting for approval, soonest first", () => {
    const { shown, total } = pickApprovalQueue([
      p("late", "2026-09-30", "09:00"),
      p("scheduled", "2026-09-26", "09:00", "scheduled"),
      p("evening", "2026-09-27", "18:00"),
      p("morning", "2026-09-27", "09:00"),
    ]);
    expect(shown.map((i) => i.id)).toEqual(["morning", "evening", "late"]);
    expect(total).toBe(3);
  });

  it("shows a few and reports how many there are in all", () => {
    const many = Array.from({ length: 9 }, (_, i) => p(`p${i}`, `2026-09-${String(20 + i)}`, null));
    const { shown, total } = pickApprovalQueue(many, 4);
    expect([shown.length, total]).toEqual([4, 9]);
    expect(shown[0].id).toBe("p0");
  });

  it("is empty when nothing is waiting", () => {
    expect(pickApprovalQueue([p("x", "2026-09-26", null, "scheduled")])).toEqual({ shown: [], total: 0 });
  });
});

describe("describeActivity", () => {
  it("turns audit entries into plain sentences", () => {
    expect(describeActivity("creative_generated", "CLIENT_MANUAL")).toBe("Made a graphic for a post");
    expect(describeActivity("content_approved", "CLIENT_MANUAL")).toBe("You approved a post");
    expect(describeActivity("report_generated", "CLIENT_MANUAL")).toBe("A report was created");
  });

  it("reads reject/skip entries, including the ones saved before the spelling was fixed", () => {
    expect(describeActivity("content_rejected", "CLIENT_MANUAL")).toBe("You rejected a post");
    expect(describeActivity("content_skipped", "CLIENT_MANUAL")).toBe("A post was skipped");
    expect(describeActivity("content_rejectd", "CLIENT_MANUAL")).toBe("You rejected a post");
    expect(describeActivity("content_skipd", "CLIENT_MANUAL")).toBe("A post was skipped");
  });

  it("tells Autopilot's posts from manual ones", () => {
    expect(describeActivity("content_generated", "AUTOPILOT")).toBe("Autopilot wrote a new post");
    expect(describeActivity("content_generated", "CLIENT_MANUAL")).toBe("AI wrote a new caption");
  });

  it("hides noise", () => {
    expect(describeActivity("login", "CLIENT_MANUAL")).toBeNull();
    expect(describeActivity("link_health_checked", "CLIENT_MANUAL")).toBeNull();
  });

  it("still shows an event type it hasn't been taught, in readable form", () => {
    expect(describeActivity("some_new_thing", "ADMIN")).toBe("Some new thing");
  });
});

describe("formatSlot", () => {
  it("writes the day and the time in words", () => {
    expect(formatSlot("2026-09-27", "09:00:00")).toBe("Sun 27 Sep · 9:00 AM");
    expect(formatSlot("2026-09-27", "18:00")).toBe("Sun 27 Sep · 6:00 PM");
  });

  it("gets noon and midnight right", () => {
    expect(formatSlot("2026-09-27", "12:30:00")).toBe("Sun 27 Sep · 12:30 PM");
    expect(formatSlot("2026-09-27", "00:05:00")).toBe("Sun 27 Sep · 12:05 AM");
  });

  it("shows just the day when there's no time", () => {
    expect(formatSlot("2026-09-27", null)).toBe("Sun 27 Sep");
  });

  it("falls back to the raw value for a date it can't read", () => {
    expect(formatSlot("soon", "09:00")).toBe("soon · 9:00 AM");
  });
});

describe("spanDays", () => {
  it("counts both end dates", () => {
    expect(spanDays({ date_range_start: "2026-09-01", date_range_end: "2026-09-28" })).toBe(28);
    expect(spanDays({ date_range_start: "2026-09-01", date_range_end: "2026-09-01" })).toBe(1);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  it("reads naturally at each scale", () => {
    expect(timeAgo("2026-09-26T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-09-26T11:20:00Z", now)).toBe("40 min ago");
    expect(timeAgo("2026-09-26T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("2026-09-26T07:00:00Z", now)).toBe("5 hours ago");
    expect(timeAgo("2026-09-25T09:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-09-22T12:00:00Z", now)).toBe("4 days ago");
    expect(timeAgo("2026-09-01T12:00:00Z", now)).toBe("1 Sep");
  });

  it("dates an older entry by the day it was in India", () => {
    // 20:00 UTC on 31 Aug is 01:30 on 1 Sep in India.
    expect(timeAgo("2026-08-31T20:00:00Z", now)).toBe("1 Sep");
  });

  it("never goes negative for a timestamp slightly in the future", () => {
    expect(timeAgo("2026-09-26T12:00:30Z", now)).toBe("just now");
  });
});

describe("comparableSeries", () => {
  const snap = (start: string, end: string, clicks: number) => ({ date_range_start: start, date_range_end: end, clicks });
  const pick = (r: { clicks: number }) => r.clicks;

  it("reads oldest → newest, with the latest and the one before it", () => {
    const rows = [snap("2026-09-01", "2026-09-28", 140), snap("2026-08-25", "2026-09-21", 100), snap("2026-08-18", "2026-09-14", 90)];
    expect(comparableSeries(rows, pick)).toEqual({ current: 140, previous: 100, values: [90, 100, 140] });
  });

  it("leaves out snapshots that cover a different number of days", () => {
    const rows = [
      snap("2026-09-01", "2026-09-28", 140), // 28 days
      snap("2026-09-01", "2026-09-07", 30), // 7 days — not comparable
      snap("2026-08-04", "2026-08-31", 120), // 28 days
    ];
    expect(comparableSeries(rows, pick)).toEqual({ current: 140, previous: 120, values: [120, 140] });
  });

  it("has no previous value when there's only one snapshot", () => {
    expect(comparableSeries([snap("2026-09-01", "2026-09-28", 140)], pick)).toEqual({ current: 140, previous: null, values: [140] });
  });

  it("keeps only the most recent points", () => {
    // Twelve one-day snapshots, newest first, worth 12, 11, … 1.
    const rows = Array.from({ length: 12 }, (_, i) => {
      const day = `2026-01-${String(12 - i).padStart(2, "0")}`;
      return snap(day, day, 12 - i);
    });
    expect(comparableSeries(rows, pick, 5).values).toEqual([8, 9, 10, 11, 12]);
  });

  it("reports nothing for no snapshots", () => {
    expect(comparableSeries([], pick)).toEqual({ current: null, previous: null, values: [] });
  });
});

describe("countInWindows", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  it("splits timestamps into the last N days and the N days before", () => {
    const stamps = [
      "2026-09-25T12:00:00Z", // 1 day ago  → last 30 days
      "2026-09-10T12:00:00Z", // 16 days ago → last 30 days
      "2026-08-20T12:00:00Z", // 37 days ago → the 30 days before that
      "2026-08-01T12:00:00Z", // 56 days ago → the 30 days before that
      "2026-07-01T12:00:00Z", // 87 days ago → older than both
      "2026-09-27T12:00:00Z", // in the future → ignored
    ];
    expect(countInWindows(stamps, now, 30)).toEqual({ current: 2, previous: 2 });
  });

  it("counts nothing for no events", () => {
    expect(countInWindows([], now, 30)).toEqual({ current: 0, previous: 0 });
  });
});

describe("sparklinePath", () => {
  it("draws a line through real points, low values at the bottom", () => {
    const path = sparklinePath([1, 5, 3], 100, 30)!;
    expect(path.startsWith("M3.0 27.0")).toBe(true); // first (lowest) point: left edge, bottom
    expect(path.split("L")).toHaveLength(3);
  });

  it("draws nothing when there is no trend yet", () => {
    expect(sparklinePath([], 100, 30)).toBeNull();
    expect(sparklinePath([7], 100, 30)).toBeNull();
  });

  it("copes with a flat series", () => {
    expect(sparklinePath([4, 4, 4], 100, 30)).toMatch(/^M3\.0 [\d.]+ L/);
  });
});
