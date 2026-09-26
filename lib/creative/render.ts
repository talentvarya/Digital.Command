import satori from "satori";
import sharp from "sharp";
import type { ReactNode } from "react";
import { POPPINS_BOLD_B64, POPPINS_REGULAR_B64 } from "@/lib/creative/font-data";
import { brandPalette, pickFontSize, type BrandPalette, type CreativeStyle } from "@/lib/creative/spec";

// Draws a post graphic on the server: satori lays the design out (flexbox +
// text, with proper shaping for Hindi) into an SVG, and sharp turns that into a
// JPEG. No headless browser and no paid service. The element tree is built from
// plain { type, props } objects, which satori accepts, so none of this needs JSX.

export interface CreativeSpec {
  style: CreativeStyle;
  width: number;
  height: number;
  headline: string;
  subline: string | null;
  businessName: string;
  contact: string | null;
  colors: string[] | null;
  logoDataUrl: string | null;
  backgroundDataUrl: string | null;
}

type CssValue = string | number;
export type Css = Record<string, CssValue>;
export interface El {
  type: string;
  props: Record<string, unknown>;
}
export type Child = El | string | null | undefined | false;

// satori insists every <div> with more than one child says display: flex, so
// every div here does. (Exported: the downloadable report is drawn the same way.)
export function box(style: Css, ...children: Child[]): El {
  return { type: "div", props: { style: { display: "flex", ...style }, children: children.filter(Boolean) } };
}

export function label(style: Css, value: string): El {
  return { type: "div", props: { style: { display: "flex", ...style }, children: value } };
}

export function image(src: string, style: Css): El {
  return { type: "img", props: { src, style } };
}

const PAD = 72;

function brandRow(spec: CreativeSpec, color: string, p: BrandPalette): El {
  return box(
    { alignItems: "center" },
    spec.logoDataUrl
      ? box(
          { background: "#ffffff", borderRadius: 16, padding: 8, marginRight: 18 },
          image(spec.logoDataUrl, { width: 52, height: 52, objectFit: "contain" })
        )
      : box({ width: 14, height: 44, borderRadius: 7, background: p.accent, marginRight: 18 }),
    label({ fontSize: 30, fontWeight: 700, color }, spec.businessName)
  );
}

// Full-bleed layers behind the text: the photo (darkened so words stay legible)
// or a brand-colour gradient with soft decorative circles.
function backgroundLayers(spec: CreativeSpec, p: BrandPalette, darkenFrom: number): El[] {
  const fill = { position: "absolute", left: 0, top: 0, width: spec.width, height: spec.height } as const;
  if (spec.backgroundDataUrl) {
    return [
      image(spec.backgroundDataUrl, { ...fill, objectFit: "cover" }),
      box({
        ...fill,
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,${darkenFrom}) 0%, rgba(0,0,0,0.80) 100%)`,
      }),
    ];
  }
  return [
    box({ ...fill, backgroundImage: `linear-gradient(135deg, ${p.primary} 0%, ${p.primaryDark} 100%)` }),
    box({
      position: "absolute",
      right: -140,
      top: -140,
      width: 520,
      height: 520,
      borderRadius: 9999,
      background: "rgba(255,255,255,0.08)",
    }),
    box({
      position: "absolute",
      left: -180,
      bottom: -180,
      width: 560,
      height: 560,
      borderRadius: 9999,
      background: "rgba(255,255,255,0.06)",
    }),
  ];
}

function textColor(spec: CreativeSpec, p: BrandPalette): string {
  return spec.backgroundDataUrl ? "#ffffff" : p.onPrimary;
}

function root(spec: CreativeSpec, style: Css, layers: El[], ...content: Child[]): El {
  return box(
    { position: "relative", width: spec.width, height: spec.height, fontFamily: "Poppins", ...style },
    ...layers,
    ...content
  );
}

const CONTENT_WIDTH = 1080 - PAD * 2;

function headlineBlock(spec: CreativeSpec, color: string, opts: { max: number; min: number; maxLines: number; align?: "left" | "center" }): El {
  const size = pickFontSize(spec.headline, CONTENT_WIDTH, opts.maxLines, opts.max, opts.min);
  return label(
    { fontSize: size, fontWeight: 700, lineHeight: 1.14, color, maxWidth: CONTENT_WIDTH, textAlign: opts.align ?? "left" },
    spec.headline
  );
}

function sublineBlock(spec: CreativeSpec, color: string, align: "left" | "center" = "left"): El | null {
  if (!spec.subline) return null;
  const size = pickFontSize(spec.subline, CONTENT_WIDTH, 3, 42, 30);
  return label({ fontSize: size, lineHeight: 1.35, color, opacity: 0.92, marginTop: 28, maxWidth: CONTENT_WIDTH, textAlign: align }, spec.subline);
}

// ---------------------------------------------------------------------------
// The four styles
// ---------------------------------------------------------------------------

function offerStyle(spec: CreativeSpec, p: BrandPalette): El {
  const color = textColor(spec, p);
  return root(
    spec,
    { flexDirection: "column", justifyContent: "space-between", padding: PAD, color },
    backgroundLayers(spec, p, 0.3),
    box(
      { flexDirection: "column", alignItems: "flex-start" },
      label(
        { fontSize: 26, fontWeight: 700, letterSpacing: 4, background: p.accent, color: p.onAccent, padding: "12px 28px", borderRadius: 999 },
        "SPECIAL OFFER"
      )
    ),
    box(
      { flexDirection: "column" },
      headlineBlock(spec, color, { max: 100, min: 56, maxLines: 4 }),
      sublineBlock(spec, color)
    ),
    box(
      { justifyContent: "space-between", alignItems: "center" },
      brandRow(spec, color, p),
      spec.contact
        ? label({ fontSize: 28, fontWeight: 700, background: p.accent, color: p.onAccent, padding: "12px 26px", borderRadius: 999 }, spec.contact)
        : null
    )
  );
}

function tipStyle(spec: CreativeSpec, p: BrandPalette): El {
  const color = textColor(spec, p);
  return root(
    spec,
    { flexDirection: "column", justifyContent: "space-between", padding: PAD, color },
    backgroundLayers(spec, p, 0.35),
    box(
      { alignItems: "flex-start" },
      label(
        { fontSize: 26, fontWeight: 700, letterSpacing: 4, color: p.accent, border: `3px solid ${p.accent}`, padding: "10px 26px", borderRadius: 999 },
        "TIP"
      )
    ),
    box(
      { flexDirection: "column" },
      label({ fontSize: 240, fontWeight: 700, color: p.accent, lineHeight: 0.8, height: 150 }, "“"),
      headlineBlock(spec, color, { max: 84, min: 48, maxLines: 5 }),
      sublineBlock(spec, color)
    ),
    brandRow(spec, color, p)
  );
}

function festivalStyle(spec: CreativeSpec, p: BrandPalette): El {
  const color = textColor(spec, p);
  const ring = Math.min(spec.width, spec.height) - 160;
  return root(
    spec,
    { flexDirection: "column", justifyContent: "center", alignItems: "center", padding: PAD, color },
    [
      ...backgroundLayers(spec, p, 0.4),
      box({
        position: "absolute",
        left: (spec.width - ring) / 2,
        top: (spec.height - ring) / 2,
        width: ring,
        height: ring,
        borderRadius: 9999,
        border: "6px solid rgba(255,255,255,0.22)",
      }),
      box({
        position: "absolute",
        left: (spec.width - (ring - 120)) / 2,
        top: (spec.height - (ring - 120)) / 2,
        width: ring - 120,
        height: ring - 120,
        borderRadius: 9999,
        background: "rgba(255,255,255,0.07)",
      }),
    ],
    box({ width: 120, height: 8, borderRadius: 4, background: p.accent, marginBottom: 40 }),
    box(
      { flexDirection: "column", alignItems: "center", maxWidth: 800 },
      label(
        {
          fontSize: pickFontSize(spec.headline, 800, 4, 104, 56),
          fontWeight: 700,
          lineHeight: 1.15,
          color,
          textAlign: "center",
          maxWidth: 800,
        },
        spec.headline
      ),
      spec.subline
        ? label(
            {
              fontSize: pickFontSize(spec.subline, 800, 3, 40, 30),
              lineHeight: 1.35,
              color,
              opacity: 0.92,
              marginTop: 28,
              textAlign: "center",
              maxWidth: 800,
            },
            spec.subline
          )
        : null
    ),
    box({ position: "absolute", left: 0, bottom: 56, width: spec.width, justifyContent: "center" }, brandRow(spec, color, p))
  );
}

function spotlightStyle(spec: CreativeSpec, p: BrandPalette): El {
  const color = textColor(spec, p);
  const hasPhoto = Boolean(spec.backgroundDataUrl);
  return root(
    spec,
    { flexDirection: "column", justifyContent: hasPhoto ? "space-between" : "center", padding: PAD, color },
    backgroundLayers(spec, p, hasPhoto ? 0.08 : 0.3),
    hasPhoto
      ? box(
          { alignItems: "center", background: "rgba(0,0,0,0.45)", padding: "12px 26px 12px 16px", borderRadius: 999, alignSelf: "flex-start" },
          brandRow(spec, "#ffffff", p)
        )
      : null,
    box(
      { alignItems: "flex-start" },
      hasPhoto ? null : box({ width: 14, height: 200, borderRadius: 7, background: p.accent, marginRight: 36, flexShrink: 0 }),
      box(
        { flexDirection: "column" },
        headlineBlock(spec, color, { max: 84, min: 48, maxLines: 4 }),
        sublineBlock(spec, color)
      )
    ),
    hasPhoto ? null : box({ position: "absolute", left: PAD, bottom: 56 }, brandRow(spec, color, p))
  );
}

export function buildElement(spec: CreativeSpec): El {
  const palette = brandPalette(spec.colors);
  switch (spec.style) {
    case "offer":
      return offerStyle(spec, palette);
    case "tip":
      return tipStyle(spec, palette);
    case "festival":
      return festivalStyle(spec, palette);
    default:
      return spotlightStyle(spec, palette);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

let fontCache: { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[] | null = null;

export function fonts() {
  if (!fontCache) {
    fontCache = [
      { name: "Poppins", data: Buffer.from(POPPINS_REGULAR_B64, "base64"), weight: 400, style: "normal" },
      { name: "Poppins", data: Buffer.from(POPPINS_BOLD_B64, "base64"), weight: 700, style: "normal" },
    ];
  }
  return fontCache;
}

export async function renderCreativeJpeg(spec: CreativeSpec): Promise<Uint8Array> {
  const svg = await satori(buildElement(spec) as unknown as ReactNode, {
    width: spec.width,
    height: spec.height,
    fonts: fonts(),
  });
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  return new Uint8Array(jpeg);
}
