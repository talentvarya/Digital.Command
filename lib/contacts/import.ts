import { normalizePhone } from "@/lib/contacts/phone";

// Reading a pasted list of customers ("Ravi Sharma, 98765 43210, vip") into
// rows. Pure, so the odd formats people paste are all covered by tests.

export const MAX_IMPORT_LINES = 500;
export const MAX_NAME = 80;
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;

export interface ParsedContact {
  name: string;
  phone: string; // digits with country code
  tags: string[];
}

export interface ImportProblem {
  line: number; // 1-based, as the person sees it
  text: string;
  reason: string;
}

export interface ParsedImport {
  contacts: ParsedContact[];
  problems: ImportProblem[];
  duplicates: number; // the same number appearing again in the same paste
  tooMany: boolean; // more lines than one import takes; the rest were ignored
}

export function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

// "VIP, Wedding lead" → ["vip", "wedding lead"]: lower-case, trimmed, no repeats.
export function cleanTags(input: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(input) ? input : (input ?? "").split(/[,;|]/);
  const seen = new Set<string>();
  for (const part of parts) {
    const tag = part.replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;
const letterCount = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
// What a cell looks like: mostly digits (plus + - ( ) and spaces) means a phone number
// — even a too-short one, so the person is told what's wrong with it rather than
// that no number was found.
const looksLikePhone = (s: string) => digitCount(s) >= 6 && digitCount(s) >= letterCount(s);

function splitLine(line: string): string[] {
  const separator = line.includes("\t") ? "\t" : line.includes(",") ? "," : line.includes(";") ? ";" : line.includes("|") ? "|" : null;
  if (separator) return line.split(separator).map((c) => c.trim()).filter((c) => c !== "");

  // No separator: "Ravi Sharma - 98765 43210", "Ravi 9876543210", "98765 43210 Ravi".
  const found = /\+?\d[\d\s().-]{6,}\d/.exec(line);
  if (found && found[0].trim() !== line) {
    const name = (line.slice(0, found.index) + " " + line.slice(found.index + found[0].length)).replace(/[-:–—]+/g, " ").trim();
    return [name, found[0].trim()].filter((c) => c !== "");
  }
  return [line];
}

export function parseContactLines(text: string): ParsedImport {
  const lines = (text ?? "").split(/\r?\n/);
  const result: ParsedImport = { contacts: [], problems: [], duplicates: 0, tooMany: false };
  const seen = new Set<string>();
  let considered = 0;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    // A header row copied from a spreadsheet.
    if (index === 0 && /\bname\b/i.test(line) && /\b(phone|mobile|number|whatsapp)\b/i.test(line)) return;

    considered++;
    if (considered > MAX_IMPORT_LINES) {
      result.tooMany = true;
      return;
    }

    const cells = splitLine(line);
    // The phone is whichever of the first two cells looks like one; a lone cell may be just a number.
    const phoneAt = cells.slice(0, 2).findIndex(looksLikePhone);
    if (phoneAt === -1) {
      result.problems.push({ line: index + 1, text: line, reason: "No phone number found on this line." });
      return;
    }
    const phone = normalizePhone(cells[phoneAt]);
    if (!phone.ok) {
      result.problems.push({ line: index + 1, text: line, reason: phone.reason });
      return;
    }
    const nameCell = cells.slice(0, 2).find((_, i) => i !== phoneAt) ?? "";
    const name = cleanName(nameCell) || "Customer";

    if (seen.has(phone.digits)) {
      result.duplicates++;
      return;
    }
    seen.add(phone.digits);
    result.contacts.push({ name, phone: phone.digits, tags: cleanTags(cells.slice(2).join(",")) });
  });

  return result;
}
