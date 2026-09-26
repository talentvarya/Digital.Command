import { describe, expect, it } from "vitest";
import {
  CALENDAR_COVERS_UNTIL,
  OCCASIONS,
  daysAway,
  daysAwayLabel,
  easterSunday,
  findOccasion,
  nthSunday,
  occasionsBetween,
} from "@/lib/occasions/calendar";

const on = (key: string) => OCCASIONS.find((o) => o.key === key)?.date;

describe("nthSunday", () => {
  it("finds the nth Sunday of a month", () => {
    expect(nthSunday(2026, 5, 2)).toBe("2026-05-10"); // Mother's Day 2026
    expect(nthSunday(2027, 5, 2)).toBe("2027-05-09");
    expect(nthSunday(2027, 6, 3)).toBe("2027-06-20"); // Father's Day 2027
    expect(nthSunday(2027, 8, 1)).toBe("2027-08-01"); // the 1st is itself a Sunday
    expect(nthSunday(2026, 11, 1)).toBe("2026-11-01"); // ditto
    expect(nthSunday(2026, 2, 4)).toBe("2026-02-22");
  });

  it("always lands on a Sunday in the right month", () => {
    for (let year = 2026; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        for (let n = 1; n <= 4; n++) {
          const date = nthSunday(year, month, n);
          const d = new Date(`${date}T00:00:00Z`);
          expect(d.getUTCDay()).toBe(0);
          expect(d.getUTCMonth() + 1).toBe(month);
        }
      }
    }
  });
});

describe("easterSunday", () => {
  it("matches the published Easter dates", () => {
    const known: Record<number, string> = {
      2024: "2024-03-31",
      2025: "2025-04-20",
      2026: "2026-04-05",
      2027: "2027-03-28",
      2028: "2028-04-16",
      2029: "2029-04-01",
      2030: "2030-04-21",
    };
    for (const [year, date] of Object.entries(known)) expect(easterSunday(Number(year))).toBe(date);
  });

  it("puts Good Friday two days before", () => {
    expect(on("good-friday-2027")).toBe("2027-03-26");
    expect(on("easter-2027")).toBe("2027-03-28");
  });
});

describe("the calendar", () => {
  it("has the big festivals for both years, on the dates checked against Drik Panchang", () => {
    expect(on("diwali-2026")).toBe("2026-11-08");
    expect(on("dhanteras-2026")).toBe("2026-11-06");
    expect(on("bhai-dooj-2026")).toBe("2026-11-11");
    expect(on("dussehra-2026")).toBe("2026-10-20");
    expect(on("navratri-2026")).toBe("2026-10-11");
    expect(on("karwa-chauth-2026")).toBe("2026-10-29");
    expect(on("holi-2027")).toBe("2027-03-22");
    expect(on("raksha-bandhan-2027")).toBe("2027-08-17");
    expect(on("ganesh-chaturthi-2027")).toBe("2027-09-04");
    expect(on("navratri-2027")).toBe("2027-09-30");
    expect(on("dussehra-2027")).toBe("2027-10-09");
    expect(on("karwa-chauth-2027")).toBe("2027-10-18");
    expect(on("dhanteras-2027")).toBe("2027-10-27");
    expect(on("diwali-2027")).toBe("2027-10-29");
    expect(on("bhai-dooj-2027")).toBe("2027-10-31");
  });

  it("keeps the Diwali days in their order", () => {
    for (const year of [2026, 2027]) {
      const order = ["dhanteras", "diwali", "govardhan-puja", "bhai-dooj"].map((k) => on(`${k}-${year}`)!);
      expect([...order].sort()).toEqual(order);
    }
  });

  it("has the fixed-date occasions every year", () => {
    expect(on("christmas-2026")).toBe("2026-12-25");
    expect(on("republic-day-2027")).toBe("2027-01-26");
    expect(on("independence-day-2027")).toBe("2027-08-15");
    expect(on("valentines-day-2027")).toBe("2027-02-14");
    expect(on("new-years-eve-2026")).toBe("2026-12-31");
  });

  it("is in date order, with every date real and every key unique", () => {
    const dates = OCCASIONS.map((o) => o.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(OCCASIONS.map((o) => o.key)).size).toBe(OCCASIONS.length);
    for (const o of OCCASIONS) {
      expect(o.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${o.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(o.date); // e.g. rejects 2027-02-30
    }
  });

  it("gives every occasion a name and a one-line angle", () => {
    for (const o of OCCASIONS) {
      expect(o.name.length, o.key).toBeGreaterThan(2);
      expect(o.angle.length, o.key).toBeGreaterThan(20);
      expect(o.angle.length, o.key).toBeLessThan(220);
    }
  });

  it("never invents a claim about a business or promises an outcome", () => {
    for (const o of OCCASIONS) expect(o.angle, o.key).not.toMatch(/guarantee|will (boost|increase|double)|best|#1/i);
  });

  it("says which dates follow the moon and might move by a day", () => {
    expect(OCCASIONS.find((o) => o.key === "eid-al-fitr-2027")?.approximate).toBe(true);
    expect(OCCASIONS.find((o) => o.key === "eid-al-adha-2027")?.approximate).toBe(true);
    expect(OCCASIONS.find((o) => o.key === "diwali-2026")?.approximate).toBeUndefined();
  });

  it("marks the big commercial moments as major, and the quieter ones not", () => {
    expect(OCCASIONS.find((o) => o.key === "diwali-2026")?.major).toBe(true);
    expect(OCCASIONS.find((o) => o.key === "holi-2027")?.major).toBe(true);
    expect(OCCASIONS.find((o) => o.key === "valentines-day-2027")?.major).toBe(true);
    expect(OCCASIONS.find((o) => o.key === "gandhi-jayanti-2026")?.major).toBe(false);
    expect(OCCASIONS.find((o) => o.key === "maha-shivaratri-2027")?.major).toBe(false);
  });

  it("covers the whole span it says it does", () => {
    expect(OCCASIONS[OCCASIONS.length - 1].date <= CALENDAR_COVERS_UNTIL).toBe(true);
    expect(occasionsBetween("2026-10-01", CALENDAR_COVERS_UNTIL).length).toBeGreaterThan(40);
  });
});

describe("occasionsBetween / findOccasion", () => {
  it("lists what falls in a window, both ends included", () => {
    const names = occasionsBetween("2026-11-06", "2026-11-11").map((o) => o.name);
    expect(names).toEqual(["Dhanteras", "Diwali", "Govardhan Puja", "Bhai Dooj"]);
  });

  it("can keep only the major ones", () => {
    const names = occasionsBetween("2026-11-06", "2026-11-11", { majorOnly: true }).map((o) => o.name);
    expect(names).toEqual(["Dhanteras", "Diwali", "Bhai Dooj"]);
  });

  it("is empty for a window with nothing in it", () => {
    expect(occasionsBetween("2026-12-01", "2026-12-10")).toEqual([]);
  });

  it("finds an occasion by key, and nothing for an unknown one", () => {
    expect(findOccasion("diwali-2026")?.date).toBe("2026-11-08");
    expect(findOccasion("not-a-festival")).toBeNull();
  });
});

describe("daysAway / daysAwayLabel", () => {
  it("counts calendar days", () => {
    expect(daysAway("2026-11-08", "2026-10-27")).toBe(12);
    expect(daysAway("2026-11-08", "2026-11-08")).toBe(0);
    expect(daysAway("2026-11-08", "2026-11-10")).toBe(-2);
  });

  it("reads naturally", () => {
    expect(daysAwayLabel(0)).toBe("today");
    expect(daysAwayLabel(1)).toBe("tomorrow");
    expect(daysAwayLabel(12)).toBe("in 12 days");
  });
});
