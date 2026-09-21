import { normalizeSlotTime } from "@/lib/publishing/schedule";

export const slotKey = (date: string, platform: string, time: string | null | undefined, defaultTime: string) =>
  `${date}:${platform}:${normalizeSlotTime(time) ?? defaultTime}`;

// Which (day, platform, slot) combinations already have an item, and how many
// consecutive days from today are completely covered — the size of Autopilot's
// rolling buffer. Times from the database carry seconds ("09:00:00") while the
// slots are "09:00"; comparing them raw made every slot look empty, so each
// fill regenerated (and paid for) content that already existed.
export function computeBufferState(params: {
  existing: { scheduled_date: string; platform: string; scheduled_time: string | null }[];
  days: string[];
  platforms: string[];
  slotTimes: string[];
  // A slot whose time has already gone can never be filled usefully (nothing
  // can be scheduled into the past), so it counts as covered — otherwise
  // today's passed morning slot would keep the buffer at zero forever.
  isPast?: (date: string, time: string) => boolean;
}): { filled: Set<string>; bufferDays: number } {
  const { existing, days, platforms, slotTimes } = params;
  const isPast = params.isPast ?? (() => false);
  const firstSlot = slotTimes[0];
  const filled = new Set(existing.map((i) => slotKey(i.scheduled_date, i.platform, i.scheduled_time, firstSlot)));

  let bufferDays = 0;
  for (const date of days) {
    const complete = platforms.every((p) =>
      slotTimes.every((t) => isPast(date, t) || filled.has(slotKey(date, p, t, firstSlot)))
    );
    if (!complete) break;
    bufferDays += 1;
  }
  return { filled, bufferDays };
}
