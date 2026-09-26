import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderCreativeJpeg, type CreativeSpec } from "@/lib/creative/render";
import { CREATIVE_SIZES, CREATIVE_STYLES, toDataUrl, type CreativeStyle } from "@/lib/creative/spec";

// Draws the real thing (satori + sharp + the embedded Poppins fonts), so a
// template that satori can't lay out, or a broken font/renderer setup, fails
// here instead of the first time a client presses "Create image".
let photo: string;
let logo: string;

beforeAll(async () => {
  const photoBytes = await sharp({ create: { width: 1080, height: 1080, channels: 3, background: "#5b7a4e" } }).jpeg().toBuffer();
  const logoBytes = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#5c3317" } }).png().toBuffer();
  photo = toDataUrl(new Uint8Array(photoBytes))!;
  logo = toDataUrl(new Uint8Array(logoBytes))!;
});

const HEADLINES: Record<CreativeStyle, string> = {
  offer: "Weekend Special: flat 20% off on handmade gift boxes",
  tip: "Store dark chocolate away from strong smells",
  festival: "Wishing you a very Happy Diwali",
  spotlight: "Meet our new Hazelnut Praline Bar",
};

const spec = (over: Partial<CreativeSpec> = {}): CreativeSpec => ({
  style: "offer",
  ...CREATIVE_SIZES.square,
  headline: HEADLINES.offer,
  subline: "Order before Sunday and get free delivery within Pune.",
  businessName: "Aura Lux Chocolate Co.",
  contact: "WhatsApp +91 85888 38594",
  colors: ["#5c3317", "#f5b301"],
  logoDataUrl: null,
  backgroundDataUrl: null,
  ...over,
});

async function meta(jpeg: Uint8Array) {
  expect(jpeg[0]).toBe(0xff); // JPEG signature
  expect(jpeg[1]).toBe(0xd8);
  return sharp(Buffer.from(jpeg)).metadata();
}

describe("renderCreativeJpeg", () => {
  it.each(CREATIVE_STYLES)("draws the %s style on brand colours at the requested size", async (style) => {
    const jpeg = await renderCreativeJpeg(spec({ style, headline: HEADLINES[style] }));
    const m = await meta(jpeg);
    expect([m.width, m.height, m.format]).toEqual([1080, 1080, "jpeg"]);
    expect(jpeg.length).toBeGreaterThan(20_000); // a real picture, not a blank canvas
  }, 60_000);

  it.each(CREATIVE_STYLES)("draws the %s style over a photo, with a logo, in portrait", async (style) => {
    const jpeg = await renderCreativeJpeg(
      spec({ style, ...CREATIVE_SIZES.portrait, headline: HEADLINES[style], backgroundDataUrl: photo, logoDataUrl: logo })
    );
    const m = await meta(jpeg);
    expect([m.width, m.height]).toEqual([1080, 1350]);
  }, 60_000);

  it("draws Hindi (Devanagari) text", async () => {
    const jpeg = await renderCreativeJpeg(
      spec({ style: "festival", headline: "दिवाली की हार्दिक शुभकामनाएँ", subline: "आपके घर में खुशियाँ हों", contact: null })
    );
    expect((await meta(jpeg)).width).toBe(1080);
  }, 60_000);

  it("copes with no subline, no contact and no brand colours", async () => {
    const jpeg = await renderCreativeJpeg(spec({ style: "spotlight", subline: null, contact: null, colors: null }));
    expect((await meta(jpeg)).height).toBe(1080);
  }, 60_000);

  it("copes with a very long headline and a very long business name", async () => {
    const jpeg = await renderCreativeJpeg(
      spec({ style: "tip", headline: "word ".repeat(40).trim(), businessName: "A Remarkably Long Business Name Pvt. Ltd. & Sons" })
    );
    expect((await meta(jpeg)).width).toBe(1080);
  }, 60_000);
});
