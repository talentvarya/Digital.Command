// content_items.scheduled_time is a Postgres `time` column, which PostgREST
// returns WITH seconds ("09:00:00"), while every slot the app writes and
// compares against is "HH:mm" ("09:00"). Two real bugs came from mixing them:
// building "…T09:00:00:00.000Z" (an invalid timestamp Buffer rejects) and the
// Autopilot "already filled?" check never matching, which regenerated
// duplicate posts. Everything that reads a slot time goes through here.
export function normalizeSlotTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

// The slot times are wall-clock labels ("Morning (9:00 AM)", "Evening (6:00 PM)")
// for an Indian business, so they must be converted from local time to UTC
// before being handed to Buffer/YouTube — treating "09:00" as UTC posted the
// morning slot at 2:30 PM IST and the evening slot at 11:30 PM. IST has no
// daylight saving, so a fixed offset is exact; a per-org timezone would replace
// this constant.
export const PUBLISH_UTC_OFFSET_MINUTES = 330;
export const DEFAULT_SLOT_TIME = "09:00";

export function toUtcIso(
  date: string,
  time: string | null | undefined,
  offsetMinutes: number = PUBLISH_UTC_OFFSET_MINUTES
): string {
  const [h, m] = (normalizeSlotTime(time) ?? DEFAULT_SLOT_TIME).split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - offsetMinutes * 60_000).toISOString();
}

export type DueAt = { ok: true; dueAt: string } | { ok: false; reason: "past" };

// Refuse to send something whose time has already passed rather than guess
// what Buffer/YouTube would do with it (reject it, or publish it instantly).
export function resolveDueAt(
  item: { scheduled_date: string; scheduled_time: string | null },
  now: Date = new Date(),
  graceMs = 60_000
): DueAt {
  const dueAt = toUtcIso(item.scheduled_date, item.scheduled_time);
  return new Date(dueAt).getTime() < now.getTime() + graceMs ? { ok: false, reason: "past" } : { ok: true, dueAt };
}
