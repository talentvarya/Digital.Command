import { daysAway, occasionsBetween, type Occasion } from "@/lib/occasions/calendar";
import { addDays } from "@/lib/utils/ist";

// Turning the calendar into something to do: which occasions to put in front of
// a business, and where to put the post it plans.

export interface PlannedPost {
  scheduled_date: string;
  platform: string;
  status?: string;
}

// A post that's dead (rejected or skipped) doesn't count as planned.
const DEAD = new Set(["rejected", "skipped"]);
const SOCIAL = new Set(["facebook", "instagram"]);

function plannedOn(posts: PlannedPost[], date: string, platform?: string): boolean {
  return posts.some((p) => p.scheduled_date === date && SOCIAL.has(p.platform) && (!platform || p.platform === platform) && !DEAD.has(p.status ?? ""));
}

export interface OccasionView {
  occasion: Occasion;
  days: number;
  planned: { facebook: boolean; instagram: boolean };
}

// The occasions to show a business: the big ones in the next `windowDays`, soonest
// first, each with whether a Facebook / Instagram post is already planned for it.
export function upcomingOccasions(posts: PlannedPost[], today: string, windowDays = 45, limit = 3): OccasionView[] {
  return occasionsBetween(today, addDays(today, windowDays), { majorOnly: true })
    .slice(0, limit)
    .map((occasion) => ({
      occasion,
      days: daysAway(occasion.date, today),
      planned: { facebook: plannedOn(posts, occasion.date, "facebook"), instagram: plannedOn(posts, occasion.date, "instagram") },
    }));
}

// The nearest big occasion, from tomorrow up to `horizonDays` ahead, that has no
// Facebook or Instagram post planned yet — worth a nudge on the home page.
export function nextOccasionNudge(posts: PlannedPost[], today: string, horizonDays = 14): { name: string; days: number } | null {
  const found = occasionsBetween(addDays(today, 1), addDays(today, horizonDays), { majorOnly: true }).find((o) => !plannedOn(posts, o.date));
  return found ? { name: found.name, days: daysAway(found.date, today) } : null;
}

// The first posting time on a day that hasn't gone yet, or null if they all have.
// `isPast` says whether a given date + time has already passed.
export function pickSlot(date: string, slotTimes: string[], isPast: (date: string, time: string) => boolean): string | null {
  return slotTimes.find((time) => !isPast(date, time)) ?? null;
}
