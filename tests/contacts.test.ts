import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, whatsappUrl } from "@/lib/contacts/phone";
import { MAX_IMPORT_LINES, cleanName, cleanTags, parseContactLines } from "@/lib/contacts/import";

const ok = (input: string) => {
  const r = normalizePhone(input);
  return r.ok ? r.digits : `ERROR: ${r.reason}`;
};

describe("normalizePhone", () => {
  it("adds India's code to a 10-digit mobile number, however it is written", () => {
    expect(ok("9876543210")).toBe("919876543210");
    expect(ok("98765 43210")).toBe("919876543210");
    expect(ok("98765-43210")).toBe("919876543210");
    expect(ok("(98765) 43210")).toBe("919876543210");
    expect(ok(" 6000123456 ")).toBe("916000123456");
  });

  it("accepts the ways Indian numbers are written with a country code or trunk zero", () => {
    expect(ok("+91 98765 43210")).toBe("919876543210");
    expect(ok("+919876543210")).toBe("919876543210");
    expect(ok("919876543210")).toBe("919876543210");
    expect(ok("09876543210")).toBe("919876543210");
    expect(ok("0091 98765 43210")).toBe("919876543210");
  });

  it("accepts other countries only when the code is written out", () => {
    expect(ok("+971 50 123 4567")).toBe("971501234567");
    expect(ok("00971501234567")).toBe("971501234567");
    expect(ok("+1 (415) 555-2671")).toBe("14155552671");
  });

  it("does not guess a country for an 11-digit number without a plus", () => {
    expect(ok("97150123456")).toMatch(/^ERROR: Add the country code/);
  });

  it("rejects landlines, short numbers and letters", () => {
    expect(ok("0114567890")).toMatch(/^ERROR/);
    expect(ok("12345")).toMatch(/^ERROR/);
    expect(ok("+91 12345 67890")).toMatch(/^ERROR: An Indian mobile number has 10 digits after \+91/);
    expect(ok("+91 98765")).toMatch(/^ERROR: An Indian mobile number/);
    expect(ok("+999")).toMatch(/^ERROR/);
    expect(ok("call me")).toMatch(/^ERROR: Enter a phone number/);
    expect(ok("")).toBe("ERROR: Enter a phone number.");
  });
});

describe("formatPhone", () => {
  it("groups Indian numbers and shows others plainly", () => {
    expect(formatPhone("919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("971501234567")).toBe("+971501234567");
  });
});

describe("whatsappUrl", () => {
  it("builds a click-to-chat link with the message encoded", () => {
    expect(whatsappUrl("919876543210", "Hi Ravi, it's ready! 🎉")).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent("Hi Ravi, it's ready! 🎉")}`
    );
  });

  it("carries Hindi text correctly", () => {
    const url = whatsappUrl("919876543210", "नमस्ते रवि जी");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe("नमस्ते रवि जी");
  });

  it("opens a plain chat when there is no message", () => {
    expect(whatsappUrl("919876543210", "  ")).toBe("https://wa.me/919876543210");
  });

  it("cuts a message too long for a link instead of producing a broken one", () => {
    const url = whatsappUrl("919876543210", "a".repeat(5000));
    expect(decodeURIComponent(url.split("?text=")[1])).toHaveLength(1500);
  });
});

describe("cleanName / cleanTags", () => {
  it("tidies a name", () => {
    expect(cleanName("  Ravi   Sharma ")).toBe("Ravi Sharma");
    expect(cleanName("x".repeat(200))).toHaveLength(80);
  });

  it("makes tags lower-case, trimmed, unique and few", () => {
    expect(cleanTags(" VIP, Wedding lead ,vip; gifting | ")).toEqual(["vip", "wedding lead", "gifting"]);
    expect(cleanTags("a,b,c,d,e,f,g")).toEqual(["a", "b", "c", "d", "e"]);
    expect(cleanTags("x".repeat(60))[0]).toHaveLength(24);
    expect(cleanTags(null)).toEqual([]);
    expect(cleanTags(["VIP", "vip", " New "])).toEqual(["vip", "new"]);
  });
});

describe("parseContactLines", () => {
  it("reads name, number and tags in the usual comma order", () => {
    const { contacts, problems } = parseContactLines("Ravi Sharma, 98765 43210, vip, wedding\nAnita Rao,+91 90000 11111");
    expect(problems).toEqual([]);
    expect(contacts).toEqual([
      { name: "Ravi Sharma", phone: "919876543210", tags: ["vip", "wedding"] },
      { name: "Anita Rao", phone: "919000011111", tags: [] },
    ]);
  });

  it("reads the number first, and tab- or semicolon-separated lists", () => {
    const { contacts } = parseContactLines("98765 43210, Ravi\nAnita\t9000011111\nMeena;9111122222;family");
    expect(contacts.map((c) => [c.name, c.phone, c.tags])).toEqual([
      ["Ravi", "919876543210", []],
      ["Anita", "919000011111", []],
      ["Meena", "919111122222", ["family"]],
    ]);
  });

  it("reads lines with no separator: 'Name - number', 'Name number', a bare number", () => {
    const { contacts } = parseContactLines("Ravi Sharma - 98765 43210\nAnita 9000011111\n9111122222");
    expect(contacts.map((c) => [c.name, c.phone])).toEqual([
      ["Ravi Sharma", "919876543210"],
      ["Anita", "919000011111"],
      ["Customer", "919111122222"],
    ]);
  });

  it("skips a spreadsheet's header row and blank lines", () => {
    const { contacts, problems } = parseContactLines("Name, Phone\n\nRavi, 9876543210\n\n");
    expect(contacts).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  it("does not mistake a house number in a name for a phone", () => {
    const { contacts } = parseContactLines("Flat 1201 Ravi, 9876543210");
    expect(contacts[0]).toMatchObject({ name: "Flat 1201 Ravi", phone: "919876543210" });
  });

  it("reports each line it can't use, with its line number and why", () => {
    const { contacts, problems } = parseContactLines("Ravi, 9876543210\nJust a name\nAnita, 12345678\nMeena, +91 98765");
    expect(contacts).toHaveLength(1);
    expect(problems.map((p) => p.line)).toEqual([2, 3, 4]);
    expect(problems[0].reason).toBe("No phone number found on this line.");
    expect(problems[2].reason).toMatch(/Indian mobile number/);
  });

  it("counts the same number pasted twice once, and keeps the first name", () => {
    const { contacts, duplicates } = parseContactLines("Ravi, 9876543210\nRavi S, +91 98765 43210\nAnita, 9000011111");
    expect(contacts.map((c) => c.name)).toEqual(["Ravi", "Anita"]);
    expect(duplicates).toBe(1);
  });

  it("takes at most one import's worth of lines and says so", () => {
    const lines = Array.from({ length: MAX_IMPORT_LINES + 25 }, (_, i) => `Person ${i}, ${String(6000000000 + i)}`).join("\n");
    const parsed = parseContactLines(lines);
    expect(parsed.contacts).toHaveLength(MAX_IMPORT_LINES);
    expect(parsed.tooMany).toBe(true);
  });

  it("copes with empty input and Windows line endings", () => {
    expect(parseContactLines("")).toEqual({ contacts: [], problems: [], duplicates: 0, tooMany: false });
    expect(parseContactLines("Ravi, 9876543210\r\nAnita, 9000011111\r\n").contacts).toHaveLength(2);
  });
});
