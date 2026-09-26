import { describe, expect, it } from "vitest";
import { nextOccasionNudge, pickSlot, upcomingOccasions, type PlannedPost } from "@/lib/occasions/plan";

const post = (date: string, platform = "instagram", status = "scheduled"): PlannedPost => ({ scheduled_date: date, platform, status });

describe("upcomingOccasions", () => {
  // 27 Oct 2026: Dhanteras is 10 days away, Diwali 12, Bhai Dooj 15.
  const today = "2026-10-27";

  it("lists the big occasions in the next 45 days, soonest first, at most three", () => {
    const list = upcomingOccasions([], today);
    expect(list.map((v) => v.occasion.name)).toEqual(["Karwa Chauth", "Dhanteras", "Diwali"]);
    expect(list.map((v) => v.days)).toEqual([2, 10, 12]);
  });

  it("leaves out the quieter occasions", () => {
    const names = upcomingOccasions([], today, 45, 10).map((v) => v.occasion.name);
    expect(names).not.toContain("Govardhan Puja");
    expect(names).not.toContain("Children's Day");
  });

  it("says which platform already has a post for it", () => {
    const list = upcomingOccasions([post("2026-11-08", "facebook"), post("2026-11-08", "youtube")], today, 45, 10);
    const diwali = list.find((v) => v.occasion.name === "Diwali")!;
    expect(diwali.planned).toEqual({ facebook: true, instagram: false });
    expect(list.find((v) => v.occasion.name === "Dhanteras")!.planned).toEqual({ facebook: false, instagram: false });
  });

  it("doesn't count a rejected or skipped post as planned", () => {
    const list = upcomingOccasions([post("2026-11-08", "facebook", "rejected"), post("2026-11-08", "instagram", "skipped")], today, 45, 10);
    expect(list.find((v) => v.occasion.name === "Diwali")!.planned).toEqual({ facebook: false, instagram: false });
  });

  it("includes an occasion that is today, and nothing that has passed", () => {
    const names = upcomingOccasions([], "2026-11-08", 5, 10).map((v) => v.occasion.name);
    expect(names[0]).toBe("Diwali");
    expect(names).not.toContain("Dhanteras");
  });

  it("is empty when nothing big is coming up", () => {
    expect(upcomingOccasions([], "2026-12-01", 10)).toEqual([]);
  });
});

describe("nextOccasionNudge", () => {
  it("names the nearest big occasion that has no post planned", () => {
    expect(nextOccasionNudge([], "2026-11-01")).toEqual({ name: "Dhanteras", days: 5 });
  });

  it("moves on to the next one once the nearest has a post", () => {
    expect(nextOccasionNudge([post("2026-11-06", "facebook")], "2026-11-01")).toEqual({ name: "Diwali", days: 7 });
  });

  it("counts a post on either Facebook or Instagram as planned", () => {
    const posts = [post("2026-11-06", "instagram"), post("2026-11-08", "facebook")];
    expect(nextOccasionNudge(posts, "2026-11-01")).toEqual({ name: "Bhai Dooj", days: 10 });
  });

  it("ignores a YouTube post, and a dead one", () => {
    expect(nextOccasionNudge([post("2026-11-06", "youtube"), post("2026-11-06", "facebook", "rejected")], "2026-11-01")).toEqual({
      name: "Dhanteras",
      days: 5,
    });
  });

  it("starts from tomorrow: an occasion today is too late to plan", () => {
    expect(nextOccasionNudge([], "2026-11-06")).toEqual({ name: "Diwali", days: 2 });
  });

  it("looks only as far ahead as it is told to", () => {
    // Navratri begins on 11 Oct, ten days after 1 Oct.
    expect(nextOccasionNudge([], "2026-10-01", 14)).toEqual({ name: "Navratri begins", days: 10 });
    expect(nextOccasionNudge([], "2026-10-01", 5)).toBeNull();
  });

  it("says nothing when nothing big is coming up", () => {
    expect(nextOccasionNudge([], "2026-12-01")).toBeNull();
    // 13-26 Nov holds only the quieter occasions (Children's Day, Guru Nanak Jayanti).
    expect(nextOccasionNudge([], "2026-11-12", 14)).toBeNull();
  });
});

describe("pickSlot", () => {
  const slots = ["09:00", "18:00"];

  it("takes the morning slot when it hasn't gone", () => {
    expect(pickSlot("2026-11-08", slots, () => false)).toBe("09:00");
  });

  it("falls back to the evening slot when the morning has gone", () => {
    expect(pickSlot("2026-11-08", slots, (_d, t) => t === "09:00")).toBe("18:00");
  });

  it("gives nothing when every slot has gone", () => {
    expect(pickSlot("2026-11-08", slots, () => true)).toBeNull();
  });
});
