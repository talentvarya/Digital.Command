import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, istDateString, nextDays } from "@/lib/utils/ist";

afterEach(() => vi.useRealTimers());

describe("istDateString", () => {
  it("is the date in India, which runs ahead of the server's UTC", () => {
    expect(istDateString(new Date("2026-09-26T03:30:00Z"))).toBe("2026-09-26"); // 09:00 IST
    // 19:00 UTC on the 26th is already 00:30 on the 27th in India.
    expect(istDateString(new Date("2026-09-26T19:00:00Z"))).toBe("2026-09-27");
    expect(istDateString(new Date("2026-09-26T18:29:00Z"))).toBe("2026-09-26"); // 23:59 IST
    expect(istDateString(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01"); // New Year arrives early in India
  });

  it("uses the current time when none is given", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T20:00:00Z")); // 01:30 IST on the 27th
    expect(istDateString()).toBe("2026-09-27");
  });
});

describe("addDays", () => {
  it("moves a date across month and year ends", () => {
    expect(addDays("2026-09-26", 5)).toBe("2026-10-01");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });
});

describe("nextDays", () => {
  it("starts from today in India and counts forward", () => {
    expect(nextDays(3, new Date("2026-09-26T08:00:00Z"))).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
  });

  it("starts from India's date in the small hours, when the server's own date is still yesterday's", () => {
    // 01:30 IST on the 27th = 20:00 UTC on the 26th. The planner used to start from the 26th.
    expect(nextDays(2, new Date("2026-09-26T20:00:00Z"))).toEqual(["2026-09-27", "2026-09-28"]);
  });

  it("gives the right number of days, even across a month end", () => {
    const days = nextDays(7, new Date("2026-09-28T08:00:00Z"));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-09-28");
    expect(days[6]).toBe("2026-10-04");
    expect(new Set(days).size).toBe(7);
  });

  it("gives nothing for a zero or negative count", () => {
    expect(nextDays(0)).toEqual([]);
    expect(nextDays(-2)).toEqual([]);
  });
});
