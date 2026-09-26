import { describe, expect, it } from "vitest";
import {
  changeLabel,
  formatCount,
  formatDate,
  formatPeriod,
  periodDays,
  positionChange,
  reportFileName,
} from "@/lib/reports/format";

describe("formatCount", () => {
  it("groups digits the Indian way", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1000)).toBe("1,000");
    expect(formatCount(12345)).toBe("12,345");
    expect(formatCount(123456)).toBe("1,23,456");
    expect(formatCount(1234567)).toBe("12,34,567");
  });

  it("rounds and keeps a sign", () => {
    expect(formatCount(1234.6)).toBe("1,235");
    expect(formatCount(-1234)).toBe("-1,234");
  });
});

describe("formatPeriod / formatDate / periodDays", () => {
  it("writes a period within one year once", () => {
    expect(formatPeriod("2026-08-26", "2026-09-25")).toBe("26 Aug – 25 Sep 2026");
  });

  it("writes both years when the period crosses New Year", () => {
    expect(formatPeriod("2025-12-20", "2026-01-18")).toBe("20 Dec 2025 – 18 Jan 2026");
  });

  it("falls back to the raw text for a date it can't read", () => {
    expect(formatPeriod("soon", "later")).toBe("soon – later");
  });

  it("formats a single date, ignoring any time part", () => {
    expect(formatDate("2026-09-26")).toBe("26 Sep 2026");
    expect(formatDate("2026-09-26T10:15:00.000Z")).toBe("26 Sep 2026");
  });

  it("is the gap between the two dates, as the period was asked for", () => {
    expect(periodDays("2026-08-26", "2026-09-25")).toBe(30);
    expect(periodDays("2026-09-18", "2026-09-25")).toBe(7);
  });

  it("has no length for an empty or backwards period", () => {
    expect(periodDays("2026-09-01", "2026-09-01")).toBeNull();
    expect(periodDays("2026-09-30", "2026-09-01")).toBeNull();
  });
});

describe("changeLabel", () => {
  it("reports a rise as good when higher is better", () => {
    expect(changeLabel(123, 100)).toEqual({ text: "+23%", tone: "good" });
  });

  it("reports a fall as bad, with a decimal for small changes", () => {
    expect(changeLabel(95.7, 100)).toEqual({ text: "-4.3%", tone: "bad" });
  });

  it("flips the meaning when lower is better", () => {
    expect(changeLabel(80, 100, false)).toEqual({ text: "-20%", tone: "good" });
    expect(changeLabel(120, 100, false)).toEqual({ text: "+20%", tone: "bad" });
  });

  it("calls a tiny move no change", () => {
    expect(changeLabel(100.2, 100)).toEqual({ text: "No change", tone: "flat" });
  });

  it("has nothing to say without an earlier figure to compare against", () => {
    expect(changeLabel(50, null)).toBeNull();
    expect(changeLabel(50, 0)).toBeNull();
  });
});

describe("positionChange", () => {
  it("treats a smaller position number as an improvement", () => {
    expect(positionChange(12.3, 14.1)).toEqual({ text: "Up 1.8 places", tone: "good" });
    expect(positionChange(14.1, 12.3)).toEqual({ text: "Down 1.8 places", tone: "bad" });
  });

  it("reports no change for a negligible move, and nothing without history", () => {
    expect(positionChange(12.3, 12.31)).toEqual({ text: "No change", tone: "flat" });
    expect(positionChange(12.3, null)).toBeNull();
  });
});

describe("reportFileName", () => {
  it("makes a safe file name from the business name", () => {
    expect(reportFileName("Aura Lux Chocolate Co.", "2026-08-26", "2026-09-25")).toBe(
      "Aura-Lux-Chocolate-Co-marketing-report-2026-08-26-to-2026-09-25.pdf"
    );
  });

  it("drops accents and non-Latin letters, and never returns an empty name", () => {
    expect(reportFileName("Café Ünique", "2026-01-01", "2026-01-31")).toMatch(/^Cafe-Unique-marketing-report/);
    expect(reportFileName("विनीत इवेंट्स", "2026-01-01", "2026-01-31")).toMatch(/^Business-marketing-report/);
    expect(reportFileName('../../etc/"passwd"', "2026-01-01", "2026-01-31")).toMatch(/^etc-passwd-marketing-report/);
  });
});
