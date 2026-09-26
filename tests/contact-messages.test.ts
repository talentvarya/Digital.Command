import { describe, expect, it } from "vitest";
import {
  MESSAGE_TEMPLATES,
  availableTemplates,
  firstName,
  pickAudience,
  renderMessage,
  unresolvedPlaceholders,
  type AudienceContact,
} from "@/lib/contacts/messages";
import { whatsappUrl } from "@/lib/contacts/phone";

describe("renderMessage", () => {
  it("fills in the customer's first name and the business", () => {
    expect(renderMessage("Hi {name}, this is {business}.", { name: "Ravi Sharma", business: "Aura Lux" })).toBe("Hi Ravi, this is Aura Lux.");
  });

  it("fills in every occurrence, and the review link", () => {
    expect(renderMessage("{name}! {name}? {review_link}", { name: "Anita", business: "B", reviewLink: "https://g.page/r/abc" })).toBe(
      "Anita! Anita? https://g.page/r/abc"
    );
  });

  it("doesn't double the full stop after a business name that already ends with one", () => {
    expect(renderMessage("Hi {name}, this is {business}. Come visit.", { name: "Ravi", business: "Aura Lux Chocolate Co." })).toBe(
      "Hi Ravi, this is Aura Lux Chocolate Co. Come visit."
    );
    expect(renderMessage("Thanks from {business}.", { name: "Ravi", business: "Aura Lux Chocolate Co." })).toBe("Thanks from Aura Lux Chocolate Co.");
    // a name with no full stop keeps the sentence's own
    expect(renderMessage("This is {business}. Hi!", { name: "Ravi", business: "Aura Lux" })).toBe("This is Aura Lux. Hi!");
    // other punctuation is left alone
    expect(renderMessage("Hello from {business}, friends", { name: "Ravi", business: "Aura Lux Co." })).toBe("Hello from Aura Lux Co., friends");
  });

  it("falls back to a friendly word when a name is missing", () => {
    expect(renderMessage("Hi {name},", { name: "  ", business: "B" })).toBe("Hi there,");
  });

  it("leaves the client's own {details} gap alone", () => {
    expect(renderMessage("Hi {name}. {details}", { name: "Ravi", business: "B" })).toBe("Hi Ravi. {details}");
  });
});

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("  Ravi   Kumar Sharma")).toBe("Ravi");
    expect(firstName("रवि शर्मा")).toBe("रवि");
    expect(firstName("")).toBe("");
  });
});

describe("unresolvedPlaceholders", () => {
  it("finds gaps the client still has to fill", () => {
    expect(unresolvedPlaceholders("Hi {name}, {details} and {DETAILS} and {date}")).toEqual(["{details}", "{DETAILS}", "{date}"]);
  });

  it("ignores the placeholders that are filled automatically", () => {
    expect(unresolvedPlaceholders("Hi {name}, {business}: {review_link}")).toEqual([]);
    expect(unresolvedPlaceholders("No placeholders here")).toEqual([]);
  });
});

describe("message templates", () => {
  it("only uses placeholders the composer knows how to fill or asks about", () => {
    for (const t of MESSAGE_TEMPLATES) {
      const unknown = unresolvedPlaceholders(t.text).filter((p) => p !== "{details}");
      expect(unknown, t.key).toEqual([]);
    }
  });

  it("has unique keys and fits in a WhatsApp link once rendered", () => {
    expect(new Set(MESSAGE_TEMPLATES.map((t) => t.key)).size).toBe(MESSAGE_TEMPLATES.length);
    for (const t of MESSAGE_TEMPLATES) {
      const text = renderMessage(t.text, { name: "Ravi", business: "Aura Lux Chocolate Co.", reviewLink: "https://g.page/r/abc" });
      expect(text.length, t.key).toBeLessThan(500);
      expect(decodeURIComponent(whatsappUrl("919876543210", text).split("?text=")[1]), t.key).toBe(text);
    }
  });

  it("offers the review messages only to a business that has a review link", () => {
    expect(availableTemplates(false).some((t) => t.needsReviewLink)).toBe(false);
    expect(availableTemplates(true).some((t) => t.needsReviewLink)).toBe(true);
    expect(availableTemplates(true)).toHaveLength(MESSAGE_TEMPLATES.length);
  });

  it("includes Hindi in Devanagari for the common cases", () => {
    const hindi = MESSAGE_TEMPLATES.filter((t) => t.language === "Hindi");
    expect(hindi.length).toBeGreaterThanOrEqual(4);
    for (const t of hindi) expect(t.text).toMatch(/[ऀ-ॿ]/);
  });
});

describe("pickAudience", () => {
  const c = (id: string, name: string, over: Partial<AudienceContact> = {}): AudienceContact => ({
    id,
    name,
    phone: "919876543210",
    tags: [],
    consent: true,
    opted_out: false,
    ...over,
  });

  it("lists only people who agreed and haven't opted out, by name", () => {
    const { sendable, withoutConsent, optedOut } = pickAudience(
      [c("1", "Zoya"), c("2", "Anita"), c("3", "Meena", { consent: false }), c("4", "Ravi", { opted_out: true }), c("5", "Kiran", { consent: false, opted_out: true })],
      null
    );
    expect(sendable.map((x) => x.name)).toEqual(["Anita", "Zoya"]);
    expect(withoutConsent).toBe(1);
    expect(optedOut).toBe(2);
  });

  it("never lets someone who opted out be messaged, even with consent recorded", () => {
    expect(pickAudience([c("1", "Ravi", { consent: true, opted_out: true })], null).sendable).toEqual([]);
  });

  it("narrows to one tag", () => {
    const list = [c("1", "Anita", { tags: ["vip"] }), c("2", "Ravi", { tags: ["wedding"] }), c("3", "Meena", { tags: ["vip", "wedding"] })];
    expect(pickAudience(list, "vip").sendable.map((x) => x.name)).toEqual(["Anita", "Meena"]);
    expect(pickAudience(list, "nobody").sendable).toEqual([]);
  });
});
