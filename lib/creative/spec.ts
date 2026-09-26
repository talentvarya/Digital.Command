import type { ContentPlatform } from "@/types/database";

// Pure helpers behind Creative Studio (post graphics): what style a caption
// suggests, what text goes on the picture, and how brand colours are used.
// Nothing here touches the network, the database or the renderer, so all of it
// is unit-tested directly.

export const CREATIVE_STYLES = ["offer", "tip", "festival", "spotlight"] as const;
export type CreativeStyle = (typeof CREATIVE_STYLES)[number];

export const CREATIVE_STYLE_LABELS: Record<CreativeStyle, string> = {
  offer: "Offer / announcement",
  tip: "Tip / quote",
  festival: "Festival wish",
  spotlight: "Spotlight",
};

export type CreativeSize = "square" | "portrait";

export const CREATIVE_SIZES: Record<CreativeSize, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Square (1080×1080)" },
  portrait: { width: 1080, height: 1350, label: "Portrait (1080×1350)" },
};

export type CreativeBackground = "colors" | "stock" | "ai";

export const CREATIVE_BACKGROUND_LABELS: Record<CreativeBackground, string> = {
  colors: "Brand colours",
  stock: "Stock photo",
  ai: "AI photo (free)",
};

// Instagram's feed favours 4:5; Facebook and everything else is fine square.
export function defaultSizeFor(platform: ContentPlatform): CreativeSize {
  return platform === "instagram" ? "portrait" : "square";
}

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

// \b doesn't work for Devanagari, so those words sit outside the \b(...) group.
const FESTIVAL =
  /\b(diwali|deepavali|dussehra|navratri|holi|eid|christmas|xmas|new year|raksha bandhan|rakhi|ganesh|janmashtami|baisakhi|pongal|onam|lohri|independence day|republic day|happy [a-z ]{0,20}day|festival|greetings?|wishes|wishing you)\b|शुभ|दिवाली|दीपावली|होली|ईद|राखी|नवरात्रि|त्योहार|बधाई/i;
const OFFER =
  /%|₹|\brs\.?\s?\d|\b(off|sale|discount|offers?|deals?|free|combo|coupon|book now|order now|limited time|only today|hurry|special price|flat)\b|ऑफर|छूट|डिस्काउंट/i;
const TIP = /\b(tips?|did you know|how to|hacks?|myth|facts?|why|ways to|secrets?|guide|reasons)\b|\?\s*$/i;

export function pickStyle(caption: string | null | undefined): CreativeStyle {
  const text = caption ?? "";
  if (FESTIVAL.test(text)) return "festival";
  if (OFFER.test(text)) return "offer";
  if (TIP.test(text)) return "tip";
  return "spotlight";
}

// ---------------------------------------------------------------------------
// Text on the picture
// ---------------------------------------------------------------------------

// The renderer's font has no emoji, and hashtags/links read badly on a graphic.
export function cleanOverlayText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[\p{Extended_Pictographic}‍️⃣]/gu, "")
    .replace(/[*_~`]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, "");
  return `${base}…`;
}

const HEADLINE_LIMITS: Record<CreativeStyle, number> = { offer: 72, tip: 96, festival: 64, spotlight: 84 };

const FALLBACK_HEADLINE: Record<CreativeStyle, string> = {
  offer: "Special offer",
  tip: "Quick tip",
  festival: "Warm wishes",
  spotlight: "",
};

// First sentence of the caption becomes the headline, the rest a short subline.
export function deriveCreativeText(
  caption: string | null | undefined,
  style: CreativeStyle,
  businessName: string
): { headline: string; subline: string | null } {
  const cleaned = cleanOverlayText(caption ?? "");
  const sentences = (cleaned.match(/[^.!?।\n]+[.!?।]*/g) ?? []).map((s) => s.trim()).filter(Boolean);

  let headline = sentences[0] ?? "";
  let rest = sentences.slice(1);
  if (headline.length < 14 && rest.length > 0) {
    headline = `${headline} ${rest[0]}`.trim();
    rest = rest.slice(1);
  }

  headline = truncateAtWord(headline.replace(/[.।]+$/, ""), HEADLINE_LIMITS[style]);
  if (!headline) headline = FALLBACK_HEADLINE[style] || businessName;

  const subline = rest.length > 0 ? truncateAtWord(rest.join(" "), 110) : null;
  return { headline, subline };
}

// Word-wrap estimate (no font metrics needed): how many lines `text` takes when
// each line holds about `charsPerLine` characters.
export function estimateLines(text: string, charsPerLine: number): number {
  let lines = 1;
  let current = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const need = current === 0 ? word.length : current + 1 + word.length;
    if (need > charsPerLine && current > 0) {
      lines++;
      current = word.length;
    } else {
      current = need;
    }
  }
  return lines;
}

// Largest font size (stepping down by 4) at which `text` fits in `maxLines`.
// Poppins runs about 0.58em per character.
export function pickFontSize(text: string, boxWidth: number, maxLines: number, max: number, min: number): number {
  for (let size = max; size >= min; size -= 4) {
    const charsPerLine = Math.max(4, Math.floor(boxWidth / (size * 0.58)));
    if (estimateLines(text, charsPerLine) <= maxLines) return size;
  }
  return min;
}

// The first product or service named in Brand Brain ("Chocolates, gift boxes"),
// used to make the picture-idea suggestions sound like this business.
export function firstProductPhrase(text: string | null | undefined): string {
  const first = (text ?? "")
    .split(/[,;\n•|]/)
    .map((part) => part.replace(/^[\s\-–—*\d.)]+/, "").trim())
    .find(Boolean);
  return first ? truncateAtWord(first, 40) : "";
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const NAMED_COLORS: Record<string, string> = {
  red: "#dc2626",
  maroon: "#7f1d1d",
  orange: "#f97316",
  saffron: "#f59e0b",
  gold: "#d4a017",
  yellow: "#facc15",
  green: "#16a34a",
  olive: "#65a30d",
  teal: "#0d9488",
  cyan: "#0891b2",
  blue: "#2563eb",
  navy: "#1e3a8a",
  purple: "#7c3aed",
  violet: "#7c3aed",
  pink: "#ec4899",
  magenta: "#c026d3",
  brown: "#78350f",
  chocolate: "#5c3317",
  cream: "#f5e6d3",
  beige: "#e7d8c3",
  grey: "#6b7280",
  gray: "#6b7280",
  black: "#111827",
  white: "#ffffff",
};

export const DEFAULT_PRIMARY = "#2947e0";
export const DEFAULT_ACCENT = "#ffb020";

export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  const named = NAMED_COLORS[raw];
  if (named) return named;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(raw);
  if (!match) return null;
  const hex = match[1];
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return `#${full}`;
}

function channels(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// WCAG relative luminance, 0 (black) to 1 (white).
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text colour that stays readable on a solid `background`.
export function readableOn(background: string): "#ffffff" | "#111827" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111827") ? "#ffffff" : "#111827";
}

// amount < 0 darkens, amount > 0 lightens (mix towards black / white).
export function shade(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(amount));
  const mixed = channels(hex).map((v) => Math.round(v + (target - v) * t));
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export interface BrandPalette {
  primary: string;
  primaryDark: string;
  accent: string;
  onPrimary: string;
  onAccent: string;
}

// Brand Brain stores colours as free text ("#1E40AF, gold"); anything that
// isn't a usable colour is skipped, and the app's own blue/amber fill the gaps.
export function brandPalette(colors: string[] | null | undefined): BrandPalette {
  const valid = (colors ?? []).map(normalizeHex).filter((c): c is string => c !== null);
  const primary = valid[0] ?? DEFAULT_PRIMARY;
  let accent = valid[1] ?? DEFAULT_ACCENT;
  // An accent that barely differs from the background can't do its job.
  if (contrastRatio(primary, accent) < 1.5) accent = readableOn(primary);
  return {
    primary,
    primaryDark: shade(primary, -0.35),
    accent,
    onPrimary: readableOn(primary),
    onAccent: readableOn(accent),
  };
}

// ---------------------------------------------------------------------------
// Stored files
// ---------------------------------------------------------------------------

export function creativeStoragePath(orgId: string, uuid: string): string {
  return `${orgId}/${uuid}-creative.jpg`;
}

// Media that Creative Studio may swap out when a new graphic is made: its own
// earlier graphics and the raw stock photo auto-attached at caption time. A
// client's own uploads are never touched.
export function isReplaceableMedia(storagePath: string): boolean {
  return /-(unsplash|creative)\.[a-z0-9]+$/i.test(storagePath);
}

// Unsplash/AI/upload bytes -> a data: URL the renderer can embed. JPEG, PNG and
// SVG only; anything else (e.g. WebP) can't be drawn, so it returns null.
export function toDataUrl(bytes: Uint8Array): string | null {
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const head = Buffer.from(bytes.subarray(0, 256)).toString("utf8").trimStart().toLowerCase();
  const isSvg = head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
  if (!isJpeg && !isPng && !isSvg) return null;
  const mime = isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/svg+xml";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
