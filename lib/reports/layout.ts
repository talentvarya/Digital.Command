import { estimateLines, truncateAtWord } from "@/lib/creative/spec";

// Fitting the report's written sections into a fixed-size page. satori can't
// measure text, so the size is chosen from an estimate — cautious enough that a
// long paragraph shrinks (or is shortened with "…") instead of running off the page.

export function splitParagraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export interface FittedText {
  size: number;
  paragraphs: string[];
  // true when the text was too long even at the smallest size and was cut short
  truncated: boolean;
}

export interface FitOptions {
  max?: number;
  min?: number;
  lineHeight?: number;
  // space between paragraphs, as a fraction of the font size
  paragraphGap?: number;
}

// Average glyph width relative to font size, on the cautious side (Devanagari
// runs a little wider than Latin).
const CHAR_WIDTH = 0.58;

export function fitParagraphs(text: string | null | undefined, width: number, maxHeight: number, options: FitOptions = {}): FittedText {
  const { max = 28, min = 20, lineHeight = 1.55, paragraphGap = 0.55 } = options;
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return { size: max, paragraphs: [], truncated: false };

  const heightAt = (size: number, list: string[]) => {
    const charsPerLine = Math.max(8, Math.floor(width / (size * CHAR_WIDTH)));
    const lines = list.reduce((sum, p) => sum + estimateLines(p, charsPerLine), 0);
    return lines * size * lineHeight + (list.length - 1) * size * paragraphGap;
  };

  for (let size = max; size >= min; size -= 2) {
    if (heightAt(size, paragraphs) <= maxHeight) return { size, paragraphs, truncated: false };
  }

  // Too long even at the smallest size: keep whole paragraphs while they fit, then
  // shorten the one that doesn't.
  const kept: string[] = [];
  for (const paragraph of paragraphs) {
    if (heightAt(min, [...kept, paragraph]) <= maxHeight) {
      kept.push(paragraph);
      continue;
    }
    let cut = paragraph;
    while (cut.length > 40 && heightAt(min, [...kept, cut]) > maxHeight) {
      cut = truncateAtWord(cut, Math.floor(cut.length * 0.85));
    }
    if (heightAt(min, [...kept, cut]) <= maxHeight) kept.push(cut);
    break;
  }
  return { size: min, paragraphs: kept, truncated: true };
}
