import { describe, expect, it } from "vitest";
import { normalizeSlotTime, resolveDueAt, toUtcIso } from "@/lib/publishing/schedule";
import { computeBufferState, slotKey } from "@/lib/planner/buffer";

describe("normalizeSlotTime", () => {
  it("treats the database's 'HH:mm:ss' and the app's 'HH:mm' as the same slot", () => {
    expect(normalizeSlotTime("09:00:00")).toBe("09:00");
    expect(normalizeSlotTime("09:00")).toBe("09:00");
    expect(normalizeSlotTime("9:05")).toBe("09:05");
    expect(normalizeSlotTime("18:00:00")).toBe("18:00");
  });

  it("returns null for empty or unparseable input", () => {
    expect(normalizeSlotTime(null)).toBeNull();
    expect(normalizeSlotTime("")).toBeNull();
    expect(normalizeSlotTime("soon")).toBeNull();
  });
});

describe("toUtcIso", () => {
  it("converts the Morning slot from IST to UTC (9:00 AM IST is 03:30 UTC)", () => {
    expect(toUtcIso("2026-09-21", "09:00")).toBe("2026-09-21T03:30:00.000Z");
  });

  it("converts the Evening slot (6:00 PM IST is 12:30 UTC)", () => {
    expect(toUtcIso("2026-09-21", "18:00")).toBe("2026-09-21T12:30:00.000Z");
  });

  it("gives a valid timestamp for the database's seconds format (the bug that made every post invalid)", () => {
    const iso = toUtcIso("2026-09-21", "09:00:00");
    expect(iso).toBe("2026-09-21T03:30:00.000Z");
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });

  it("rolls back to the previous UTC day for early-morning IST times", () => {
    expect(toUtcIso("2026-09-21", "02:00")).toBe("2026-09-20T20:30:00.000Z");
  });

  it("defaults to the 9:00 morning slot when no time is set", () => {
    expect(toUtcIso("2026-09-21", null)).toBe("2026-09-21T03:30:00.000Z");
  });
});

describe("resolveDueAt", () => {
  const now = new Date("2026-09-21T05:00:00.000Z"); // 10:30 AM IST

  it("accepts a future slot and returns its UTC time", () => {
    expect(resolveDueAt({ scheduled_date: "2026-09-21", scheduled_time: "18:00:00" }, now)).toEqual({
      ok: true,
      dueAt: "2026-09-21T12:30:00.000Z",
    });
  });

  it("refuses a slot whose time has already passed", () => {
    expect(resolveDueAt({ scheduled_date: "2026-09-21", scheduled_time: "09:00:00" }, now)).toEqual({ ok: false, reason: "past" });
    expect(resolveDueAt({ scheduled_date: "2026-09-20", scheduled_time: "18:00" }, now)).toEqual({ ok: false, reason: "past" });
  });

  it("refuses a slot due within the next minute", () => {
    const almost = new Date("2026-09-21T03:29:30.000Z");
    expect(resolveDueAt({ scheduled_date: "2026-09-21", scheduled_time: "09:00" }, almost).ok).toBe(false);
  });
});

describe("Autopilot buffer state", () => {
  const slots = ["09:00", "18:00"];
  const days = ["2026-09-21", "2026-09-22", "2026-09-23"];

  it("sees items stored with seconds as filling their slot (previously it saw every slot as empty)", () => {
    const existing = [
      { scheduled_date: "2026-09-21", platform: "facebook", scheduled_time: "09:00:00" },
      { scheduled_date: "2026-09-21", platform: "facebook", scheduled_time: "18:00:00" },
    ];
    const { filled, bufferDays } = computeBufferState({ existing, days, platforms: ["facebook"], slotTimes: slots });
    expect(filled.has(slotKey("2026-09-21", "facebook", "09:00", "09:00"))).toBe(true);
    expect(filled.has(slotKey("2026-09-21", "facebook", "18:00", "09:00"))).toBe(true);
    expect(bufferDays).toBe(1);
  });

  it("counts only consecutive fully covered days from today", () => {
    const both = (d: string) => [
      { scheduled_date: d, platform: "facebook", scheduled_time: "09:00:00" },
      { scheduled_date: d, platform: "facebook", scheduled_time: "18:00:00" },
    ];
    const existing = [...both("2026-09-21"), ...both("2026-09-23")]; // gap on the 22nd
    expect(computeBufferState({ existing, days, platforms: ["facebook"], slotTimes: slots }).bufferDays).toBe(1);
  });

  it("requires every selected platform to be covered", () => {
    const existing = [
      { scheduled_date: "2026-09-21", platform: "facebook", scheduled_time: "09:00:00" },
      { scheduled_date: "2026-09-21", platform: "facebook", scheduled_time: "18:00:00" },
    ];
    expect(computeBufferState({ existing, days, platforms: ["facebook", "instagram"], slotTimes: slots }).bufferDays).toBe(0);
  });

  it("treats an item with no time as the first (morning) slot", () => {
    const existing = [{ scheduled_date: "2026-09-21", platform: "facebook", scheduled_time: null }];
    expect(computeBufferState({ existing, days, platforms: ["facebook"], slotTimes: slots }).filled.has("2026-09-21:facebook:09:00")).toBe(true);
  });
});
