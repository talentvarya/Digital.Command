// "Today" for an Indian business. Servers run in UTC, which is 5 hours 30 minutes
// behind India, so between midnight and 5:30 AM IST the server's own date is still
// yesterday's — anything that means "today" or "the next 7 days" for the client
// must count from the date in India instead. India has no daylight saving, so a
// fixed offset is exact.

export const IST_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;

// The calendar date in India, as YYYY-MM-DD.
export function istDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

// A YYYY-MM-DD date moved forward (or back) by whole days.
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Today in India and the days after it: nextDays(3) → ["2026-09-26", "2026-09-27", "2026-09-28"].
export function nextDays(count: number, now: Date = new Date()): string[] {
  const start = istDateString(now);
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(start, i));
}
