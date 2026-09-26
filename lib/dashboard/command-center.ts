// The logic behind the client home page ("Command Center"): what needs the
// client's attention, how audit-log entries read in plain words, and small
// number/time helpers. Pure functions only — the page does the queries — so all
// of it is unit-tested.

import { pickBatchItems } from "@/lib/creative/eligibility";

// India has no daylight saving, so a fixed offset is exact.
const IST_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;

// A YYYY-MM-DD date moved forward (or back) by whole days.
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function istHour(now: Date): number {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).getUTCHours();
}

// Today's date in India as YYYY-MM-DD — what "today" means to the client, even
// when the server (UTC) is still on the previous day.
export function istDateString(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function greetingFor(now: Date): string {
  const hour = istHour(now);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Hello";
}

// null when there's nothing to compare against (no previous value, or it was zero).
export function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPercent(pct: number | null): string | null {
  if (pct === null) return null;
  if (Math.abs(pct) < 0.5) return "no change";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(Math.abs(pct) >= 10 ? 0 : 1)}%`;
}

// ---------------------------------------------------------------------------
// Needs your attention
// ---------------------------------------------------------------------------

export interface AttentionInput {
  waitingApproval: number;
  publishErrors: number;
  // Upcoming Facebook/Instagram posts with no picture at all.
  postsWithoutImage: number;
  reviewsNeedingReply: number;
  // Google connections that have stopped working and must be reconnected.
  connectionsToFix: number;
  // Facebook/Instagram posts are waiting to go out but no publishing channel is linked.
  noPublishingChannel: boolean;
  brandIncomplete: boolean;
  // See daysUntil(): 0 = ends today, negative = already ended.
  daysUntilExpiry: number | null;
}

export type AttentionTone = "urgent" | "todo" | "info";

export interface AttentionItem {
  key: string;
  tone: AttentionTone;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// An upcoming planner post as the home page loads it, with its pictures.
export interface UpcomingItem {
  id: string;
  platform: string;
  status: string;
  locked: boolean;
  publish_status: string;
  scheduled_date: string;
  scheduled_time: string | null;
  caption: string | null;
  content_media?: { storage_path: string }[] | null;
}

const SENDS_VIA_CHANNEL = ["facebook", "instagram"];
const WILL_BE_SENT = ["waiting_approval", "approved", "scheduled"];

// Turns the raw rows the page loads into the counts and flags the attention list needs.
export function deriveAttentionInput(args: {
  items: UpcomingItem[];
  // Platforms ("facebook" / "instagram") that have a publishing channel linked.
  linkedPlatforms: string[];
  // Status of each of the client's Google connections.
  googleStatuses: string[];
  reviews: { reply_status: string }[];
  brand: { logo_path?: string | null; colors?: unknown } | null;
  daysUntilExpiry: number | null;
}): AttentionInput {
  const { items } = args;
  const mediaByItem = new Map(items.map((i) => [i.id, i.content_media ?? []]));
  const linked = new Set(args.linkedPlatforms);

  const colors = args.brand?.colors;
  const brandIncomplete = !args.brand?.logo_path || !Array.isArray(colors) || colors.length === 0;

  return {
    waitingApproval: items.filter((i) => i.status === "waiting_approval").length,
    publishErrors: items.filter((i) => i.publish_status === "error").length,
    postsWithoutImage: pickBatchItems(items, mediaByItem, Number.MAX_SAFE_INTEGER).length,
    reviewsNeedingReply: args.reviews.filter((r) => r.reply_status === "needs_reply").length,
    connectionsToFix: args.googleStatuses.filter((s) => s === "reconnect_required" || s === "error").length,
    noPublishingChannel: items.some(
      (i) => SENDS_VIA_CHANNEL.includes(i.platform) && WILL_BE_SENT.includes(i.status) && !linked.has(i.platform)
    ),
    brandIncomplete,
    daysUntilExpiry: args.daysUntilExpiry,
  };
}

// The posts waiting for a yes, soonest first, and how many there are in all.
export function pickApprovalQueue<T extends UpcomingItem>(items: T[], limit = 4): { shown: T[]; total: number } {
  const when = (i: UpcomingItem) => `${i.scheduled_date} ${i.scheduled_time ?? ""}`;
  const waiting = items.filter((i) => i.status === "waiting_approval").sort((a, b) => when(a).localeCompare(when(b)));
  return { shown: waiting.slice(0, limit), total: waiting.length };
}

export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  // (Master STOP isn't listed here: while it's on, the page shows its own banner.)
  const items: AttentionItem[] = [];

  if (input.publishErrors > 0) {
    items.push({
      key: "publish_errors",
      tone: "urgent",
      title: `${input.publishErrors} ${plural(input.publishErrors, "post", "posts")} couldn't be sent`,
      detail: "Open the planner to see why and press Retry.",
      href: "/app/planner",
      cta: "Fix in planner",
    });
  }
  if (input.connectionsToFix > 0) {
    items.push({
      key: "connections",
      tone: "urgent",
      title: `${input.connectionsToFix} Google ${plural(input.connectionsToFix, "connection needs", "connections need")} reconnecting`,
      detail: "Reports and SEO data stop updating until it's reconnected.",
      href: "/app/health",
      cta: "Reconnect",
    });
  }
  if (input.noPublishingChannel) {
    items.push({
      key: "no_channel",
      tone: "urgent",
      title: "No publishing channel is linked yet",
      detail: "Approved Facebook/Instagram posts wait until your Digital Command contact links your page.",
      href: "/app/health",
      cta: "See connections",
    });
  }
  if (input.waitingApproval > 0) {
    items.push({
      key: "approvals",
      tone: "todo",
      title: `${input.waitingApproval} ${plural(input.waitingApproval, "post is", "posts are")} waiting for your approval`,
      detail: "Nothing goes out until you approve it.",
      href: "/app/planner",
      cta: "Review posts",
    });
  }
  if (input.postsWithoutImage > 0) {
    items.push({
      key: "images",
      tone: "todo",
      title: `${input.postsWithoutImage} upcoming ${plural(input.postsWithoutImage, "post has", "posts have")} no graphic yet`,
      detail: "Instagram needs a picture. Make branded graphics for all of them in one click.",
      href: "/app/planner",
      cta: "Create images",
    });
  }
  if (input.reviewsNeedingReply > 0) {
    items.push({
      key: "reviews",
      tone: "todo",
      title: `${input.reviewsNeedingReply} ${plural(input.reviewsNeedingReply, "review needs", "reviews need")} a reply`,
      detail: "Prompt replies show customers you're listening.",
      href: "/app/reputation",
      cta: "Reply",
    });
  }
  if (input.daysUntilExpiry !== null && input.daysUntilExpiry <= 14) {
    items.push({
      key: "expiry",
      tone: input.daysUntilExpiry <= 7 ? "urgent" : "todo",
      title:
        input.daysUntilExpiry < 0
          ? "Your package has expired"
          : input.daysUntilExpiry === 0
            ? "Your package ends today"
            : `Your package ends in ${input.daysUntilExpiry} ${plural(input.daysUntilExpiry, "day", "days")}`,
      detail: "Contact your Digital Command contact to renew so nothing pauses.",
      href: "/app/dashboard",
      cta: "See account",
    });
  }
  if (input.brandIncomplete) {
    items.push({
      key: "brand",
      tone: "info",
      title: "Add your logo and brand colours",
      detail: "Graphics and captions match your brand once Brand Brain is filled in.",
      href: "/app/brand",
      cta: "Open Brand Brain",
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// "What Digital Command did for you"
// ---------------------------------------------------------------------------

// Audit-log entries in plain words. null hides an entry that would only be noise.
const HIDDEN = new Set(["login", "link_health_checked"]);

const FRIENDLY: Record<string, string> = {
  creative_generated: "Made a graphic for a post",
  content_approved: "You approved a post",
  content_rejected: "You rejected a post",
  content_skipped: "A post was skipped",
  // Older entries were saved with a misspelt name ("content_rejectd" / "content_skipd").
  content_rejectd: "You rejected a post",
  content_skipd: "A post was skipped",
  content_edited: "You edited a post",
  content_created_manually: "You added a post",
  content_created_by_assistant: "The AI Assistant drafted a post",
  content_edited_by_assistant: "The AI Assistant edited a post",
  content_regenerated_by_assistant: "The AI Assistant rewrote a post",
  content_skipped_by_assistant: "The AI Assistant skipped a post",
  content_deleted: "A post was deleted",
  content_version_restored: "An earlier caption was restored",
  planner_cleared: "The planner was cleared",
  sent_to_buffer: "A post was sent to Facebook/Instagram",
  uploaded_to_youtube: "A video was uploaded to YouTube",
  report_generated: "A report was created",
  seo_audit_run: "Your website's SEO audit ran",
  aeo_audit_run: "Your AI-search audit ran",
  ai_visibility_check_run: "Checked what Google's AI says about you",
  competitor_search_run: "Ran a competitor search",
  brand_profile_updated: "Brand Brain was updated",
  control_mode_changed: "Content mode was changed",
  google_service_connected: "Connected a Google service",
  google_service_disconnected: "Disconnected a Google service",
  apify_connected: "Connected your Apify account",
  buffer_channel_linked: "A publishing channel was linked",
  buffer_channel_unlinked: "A publishing channel was unlinked",
  review_request_logged: "A review request was sent",
  review_reply_posted: "A review reply was posted",
  master_stop_engaged: "Automation was paused (Master STOP)",
  master_stop_lifted: "Automation was resumed",
  conversion_link_created: "Created a tracking link",
  conversion_link_deleted: "Removed a tracking link",
  conversion_logged: "Logged a lead or sale",
  link_added: "Added a website or channel link",
  link_updated: "Updated a website or channel link",
  link_removed: "Removed a website or channel link",
  local_seo_post_posted: "Marked a Google Post as posted",
  off_page_opportunity_added: "Added an off-page opportunity",
  outreach_marked_sent: "Marked an outreach email as sent",
  paid_campaign_drafted: "A paid-campaign brief was drafted",
  paid_campaign_updated: "A paid-campaign brief was updated",
  paid_campaign_submitted_for_approval: "A paid-campaign brief was sent for approval",
  paid_campaign_approved: "You approved a paid-campaign brief",
  paid_campaign_rejected: "A paid-campaign brief was rejected",
  paid_campaign_marked_launched: "A paid campaign was launched",
  paid_campaign_performance_updated: "Paid-campaign results were updated",
  paid_campaign_deleted: "A paid-campaign brief was deleted",
  registration_submitted: "Registration was submitted",
  verification_reviewed: "Your business verification was reviewed",
  payment_reviewed: "Your payment was reviewed",
  client_activated: "Your account was activated",
  account_created: "Your account was created",
  org_offboarded: "The account was closed",
  application_rejected: "The application was rejected",
};

export function describeActivity(actionType: string, source: string): string | null {
  if (HIDDEN.has(actionType)) return null;
  if (actionType === "content_generated") {
    return source === "AUTOPILOT" ? "Autopilot wrote a new post" : "AI wrote a new caption";
  }
  const known = FRIENDLY[actionType];
  if (known) return known;
  const words = actionType.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

// Month and weekday names are spelled out here rather than taken from the
// runtime's locale data, which abbreviates September as "Sept" in some versions.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A post's slot as words: "Sat 27 Sep · 9:00 AM". The stored date and time are
// already India time, so nothing is converted — only formatted.
export function formatSlot(date: string, time: string | null): string {
  const day = new Date(`${date}T00:00:00Z`);
  const dayLabel = Number.isNaN(day.getTime())
    ? date
    : `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
  const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null;
  if (!match) return dayLabel;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${dayLabel} · ${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${suffix}`;
}

export function timeAgo(when: Date | string, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(when).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const onDay = new Date(new Date(when).getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${onDay.getUTCDate()} ${MONTHS[onDay.getUTCMonth()]}`;
}

// ---------------------------------------------------------------------------
// Results: trends from real snapshots only
// ---------------------------------------------------------------------------

export interface SnapshotSpan {
  date_range_start: string;
  date_range_end: string;
}

export function spanDays(row: SnapshotSpan): number {
  const ms = new Date(row.date_range_end).getTime() - new Date(row.date_range_start).getTime();
  return Math.round(ms / DAY_MS) + 1;
}

export interface Series {
  current: number | null;
  previous: number | null;
  // Oldest → newest, at most `limit` points.
  values: number[];
}

// Rows arrive newest first. Numbers only compare fairly between snapshots that
// cover the same number of days, so anything spanning a different length from
// the newest one is left out of the trend rather than mixed in.
export function comparableSeries<T extends SnapshotSpan>(rowsNewestFirst: T[], value: (row: T) => number, limit = 8): Series {
  if (rowsNewestFirst.length === 0) return { current: null, previous: null, values: [] };
  const span = spanDays(rowsNewestFirst[0]);
  const values = rowsNewestFirst
    .filter((r) => spanDays(r) === span)
    .slice(0, limit)
    .map(value)
    .reverse();
  return {
    current: values[values.length - 1],
    previous: values.length > 1 ? values[values.length - 2] : null,
    values,
  };
}

// How many of these timestamps fall in the last `days`, and in the `days` before that.
export function countInWindows(timestamps: string[], now: Date, days: number): { current: number; previous: number } {
  const end = now.getTime();
  const mid = end - days * DAY_MS;
  const start = mid - days * DAY_MS;
  let current = 0;
  let previous = 0;
  for (const t of timestamps) {
    const at = new Date(t).getTime();
    if (at > mid && at <= end) current++;
    else if (at > start && at <= mid) previous++;
  }
  return { current, previous };
}

// Calendar days from today (in India) to an expiry date (YYYY-MM-DD): 0 on the
// expiry day itself, negative once it has passed. null when there is no date.
export function daysUntil(expiry: string | null, now: Date): number | null {
  if (!expiry) return null;
  const expiryDay = Date.parse(`${expiry}T00:00:00Z`);
  if (Number.isNaN(expiryDay)) return null;
  const today = Date.parse(`${istDateString(now)}T00:00:00Z`);
  return Math.round((expiryDay - today) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

// SVG path for a tiny trend line, or null when there isn't a real trend to draw
// (fewer than two points). Never invents data.
export function sparklinePath(values: number[], width: number, height: number, pad = 3): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + (height - pad * 2) * (1 - (v - min) / range);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
