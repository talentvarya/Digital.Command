import { describe, expect, it } from "vitest";
import {
  brandPalette,
  cleanOverlayText,
  contrastRatio,
  creativeStoragePath,
  defaultSizeFor,
  deriveCreativeText,
  estimateLines,
  isReplaceableMedia,
  normalizeHex,
  pickFontSize,
  pickStyle,
  readableOn,
  toDataUrl,
  truncateAtWord,
} from "@/lib/creative/spec";
import { buildImagePrompt } from "@/lib/creative/prompt";
import { BATCH_LIMIT, graphicBlockedReason, pickBatchItems, type GraphicItem } from "@/lib/creative/eligibility";

describe("pickStyle", () => {
  it("recognises festival wishes, in English and Hindi", () => {
    expect(pickStyle("Wishing you a very Happy Diwali!")).toBe("festival");
    expect(pickStyle("दिवाली की हार्दिक शुभकामनाएँ")).toBe("festival");
    expect(pickStyle("Happy Independence Day from all of us")).toBe("festival");
  });

  it("recognises offers by prices, percentages and sale words", () => {
    expect(pickStyle("Flat 20% off this weekend")).toBe("offer");
    expect(pickStyle("Gift box at just ₹499")).toBe("offer");
    expect(pickStyle("Order now and get free delivery")).toBe("offer");
    expect(pickStyle("आज का ऑफर")).toBe("offer");
  });

  it("recognises tips and questions", () => {
    expect(pickStyle("Tip: store chocolate in a cool place")).toBe("tip");
    expect(pickStyle("Did you know cocoa is a fruit seed?")).toBe("tip");
    expect(pickStyle("Which flavour is your favourite?")).toBe("tip");
  });

  it("falls back to spotlight, and a festival beats an offer", () => {
    expect(pickStyle("Meet our new hazelnut bar")).toBe("spotlight");
    expect(pickStyle(null)).toBe("spotlight");
    expect(pickStyle("Diwali gift boxes, 15% off")).toBe("festival");
  });
});

describe("text on the picture", () => {
  it("strips hashtags, links, emoji and markdown", () => {
    expect(cleanOverlayText("Fresh batch 🍫✨ out now! *Order* at https://x.co/abc #chocolate #gift")).toBe("Fresh batch out now! Order at");
  });

  it("truncates at a word boundary with an ellipsis", () => {
    expect(truncateAtWord("short", 20)).toBe("short");
    const out = truncateAtWord("one two three four five six seven", 15);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(15);
    expect(out).not.toMatch(/\s…$/);
  });

  it("uses the first sentence as the headline and the rest as the subline", () => {
    const { headline, subline } = deriveCreativeText(
      "Weekend Special: flat 20% off on gift boxes. Order before Sunday and get free delivery. #offer",
      "offer",
      "Aura Lux"
    );
    expect(headline).toBe("Weekend Special: flat 20% off on gift boxes");
    expect(subline).toBe("Order before Sunday and get free delivery.");
  });

  it("joins a very short first sentence with the next one", () => {
    expect(deriveCreativeText("Hello! Fresh chocolates are here today.", "spotlight", "X").headline).toBe("Hello! Fresh chocolates are here today");
  });

  it("caps a long headline for the style", () => {
    const long = "word ".repeat(60).trim();
    expect(deriveCreativeText(long, "offer", "X").headline.length).toBeLessThanOrEqual(72);
  });

  it("falls back to a stock line (or the business name) when the caption is empty", () => {
    expect(deriveCreativeText("", "offer", "Aura Lux").headline).toBe("Special offer");
    expect(deriveCreativeText(null, "spotlight", "Aura Lux").headline).toBe("Aura Lux");
    expect(deriveCreativeText("#only #hashtags", "festival", "Aura Lux").headline).toBe("Warm wishes");
  });

  it("handles Hindi sentences ending in a danda", () => {
    const { headline, subline } = deriveCreativeText("दिवाली की शुभकामनाएँ। आपके घर में खुशियाँ हों।", "festival", "X");
    expect(headline).toBe("दिवाली की शुभकामनाएँ");
    expect(subline).toBe("आपके घर में खुशियाँ हों।");
  });
});

describe("font sizing", () => {
  it("estimates wrapped lines", () => {
    expect(estimateLines("aaa bbb ccc", 20)).toBe(1);
    expect(estimateLines("aaaa bbbb cccc", 9)).toBe(2);
    expect(estimateLines("", 10)).toBe(1);
  });

  it("keeps short text at the maximum size and shrinks long text", () => {
    expect(pickFontSize("Big sale", 936, 4, 100, 56)).toBe(100);
    const shrunk = pickFontSize("word ".repeat(30).trim(), 936, 4, 100, 56);
    expect(shrunk).toBeLessThan(100);
    expect(shrunk).toBeGreaterThanOrEqual(56);
  });

  it("never goes below the minimum", () => {
    expect(pickFontSize("x ".repeat(500), 936, 2, 100, 56)).toBe(56);
  });
});

describe("colours", () => {
  it("normalises hex codes and a few colour names, rejecting junk", () => {
    expect(normalizeHex("#1E40AF")).toBe("#1e40af");
    expect(normalizeHex("f5b")).toBe("#ff55bb");
    expect(normalizeHex("Gold")).toBe("#d4a017");
    expect(normalizeHex("not a colour")).toBeNull();
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });

  it("picks readable text for light and dark backgrounds", () => {
    expect(readableOn("#111827")).toBe("#ffffff");
    expect(readableOn("#f5e6d3")).toBe("#111827");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("uses the brand's first two colours and falls back to the app's own", () => {
    const brand = brandPalette(["#5c3317", "gold"]);
    expect(brand.primary).toBe("#5c3317");
    expect(brand.accent).toBe("#d4a017");
    expect(brand.onPrimary).toBe("#ffffff");

    const empty = brandPalette([]);
    expect(empty.primary).toBe("#2947e0");
    expect(empty.accent).toBe("#ffb020");

    expect(brandPalette(["nonsense", "#111111"]).primary).toBe("#111111");
    expect(brandPalette(null).primary).toBe("#2947e0");
  });

  it("won't use an accent that vanishes into the background", () => {
    const p = brandPalette(["#2947e0", "#2a48e1"]);
    expect(contrastRatio(p.primary, p.accent)).toBeGreaterThanOrEqual(1.5);
  });
});

describe("files", () => {
  it("names graphics so they can be recognised (and replaced) later", () => {
    const path = creativeStoragePath("org-1", "abc");
    expect(path).toBe("org-1/abc-creative.jpg");
    expect(isReplaceableMedia(path)).toBe(true);
    expect(isReplaceableMedia("org-1/9f2-unsplash.jpg")).toBe(true);
  });

  it("never treats a client's own upload as replaceable", () => {
    expect(isReplaceableMedia("org-1/9f2-my-shop-photo.jpg")).toBe(false);
    expect(isReplaceableMedia("org-1/9f2-creative-notes.pdf")).toBe(false);
    expect(isReplaceableMedia("org-1/9f2-unsplash-lookalike.png")).toBe(false);
  });

  it("turns JPEG, PNG and SVG bytes into data URLs and refuses anything else", () => {
    expect(toDataUrl(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toMatch(/^data:image\/jpeg;base64,/);
    expect(toDataUrl(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toMatch(/^data:image\/png;base64,/);
    expect(toDataUrl(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(toDataUrl(new TextEncoder().encode("RIFFxxxxWEBPVP8 "))).toBeNull();
    expect(toDataUrl(new Uint8Array())).toBeNull();
  });

  it("defaults Instagram to portrait and everything else to square", () => {
    expect(defaultSizeFor("instagram")).toBe("portrait");
    expect(defaultSizeFor("facebook")).toBe("square");
  });
});

describe("buildImagePrompt", () => {
  it("asks for a text-free photo and carries the business context", () => {
    const prompt = buildImagePrompt({
      headline: "New hazelnut praline bar",
      businessName: "Aura Lux Chocolate Co.",
      businessDescription: "Handmade chocolates in Pune",
      imageStyle: "Warm, rustic, close-up",
      wordsToAvoid: ["cheap", " discount "],
    });
    expect(prompt).toContain("Aura Lux Chocolate Co.");
    expect(prompt).toContain("Handmade chocolates in Pune");
    expect(prompt).toContain("Warm, rustic, close-up");
    expect(prompt).toContain("No text");
    expect(prompt).toContain("Do not depict: cheap, discount.");
  });

  it("stays within its length limit even with huge inputs", () => {
    const prompt = buildImagePrompt({ headline: "h".repeat(5000), businessName: "b".repeat(5000), businessDescription: "d".repeat(5000), imageStyle: "s".repeat(5000) });
    expect(prompt.length).toBeLessThanOrEqual(1200);
  });
});

const item = (over: Partial<GraphicItem> = {}): GraphicItem => ({
  id: "i1",
  platform: "instagram",
  status: "draft",
  locked: false,
  publish_status: "not_sent",
  scheduled_date: "2026-09-27",
  scheduled_time: "09:00:00",
  ...over,
});

describe("which posts can get a graphic", () => {
  it("allows ordinary Facebook/Instagram posts", () => {
    expect(graphicBlockedReason(item())).toBeNull();
    expect(graphicBlockedReason(item({ platform: "facebook", status: "scheduled" }))).toBeNull();
  });

  it("blocks YouTube, locked, finished and already-sent posts, with a reason", () => {
    expect(graphicBlockedReason(item({ platform: "youtube" }))).toMatch(/Facebook and Instagram/);
    expect(graphicBlockedReason(item({ locked: true }))).toMatch(/locked/);
    expect(graphicBlockedReason(item({ status: "published" }))).toMatch(/finished/);
    expect(graphicBlockedReason(item({ publish_status: "sent" }))).toMatch(/already been sent/);
  });

  it("picks the soonest posts with no picture of the client's own, up to the limit", () => {
    const items = [
      item({ id: "late", scheduled_date: "2026-09-30" }),
      item({ id: "soon", scheduled_date: "2026-09-27", scheduled_time: "09:00:00" }),
      item({ id: "evening", scheduled_date: "2026-09-27", scheduled_time: "18:00:00" }),
      item({ id: "own-photo" }),
      item({ id: "has-graphic" }),
      item({ id: "auto-stock" }),
      item({ id: "locked", locked: true }),
    ];
    const media = new Map([
      ["own-photo", [{ storage_path: "o/1-shop.jpg" }]],
      ["has-graphic", [{ storage_path: "o/2-creative.jpg" }]],
      ["auto-stock", [{ storage_path: "o/3-unsplash.jpg" }]],
    ]);
    const picked = pickBatchItems(items, media);
    expect(picked).not.toContain("own-photo");
    expect(picked).not.toContain("has-graphic");
    expect(picked).not.toContain("locked");
    expect(picked).toContain("auto-stock");
    expect(picked.indexOf("soon")).toBeLessThan(picked.indexOf("evening"));
    expect(picked.indexOf("evening")).toBeLessThan(picked.indexOf("late"));
  });

  it("never returns more than the batch limit", () => {
    const many = Array.from({ length: 50 }, (_, n) => item({ id: `p${n}`, scheduled_date: `2026-10-${String((n % 28) + 1).padStart(2, "0")}` }));
    expect(pickBatchItems(many, new Map())).toHaveLength(BATCH_LIMIT);
  });
});
