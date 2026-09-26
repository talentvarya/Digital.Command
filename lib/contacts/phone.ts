// Customer phone numbers, kept as digits with the country code and no "+"
// (919876543210) — the form WhatsApp's click-to-chat links use.

export type PhoneResult = { ok: true; digits: string } | { ok: false; reason: string };

const INDIA = "91";
const HELP = "Add the country code with a +, for example +971 50 123 4567. Indian numbers can be written with 10 digits.";

function international(digits: string): PhoneResult {
  if (digits.startsWith("0")) return { ok: false, reason: HELP };
  if (digits.startsWith(INDIA)) {
    // 91 belongs only to India: ten digits follow, and mobile numbers start with 6-9.
    return /^91[6-9]\d{9}$/.test(digits) ? { ok: true, digits } : { ok: false, reason: "An Indian mobile number has 10 digits after +91." };
  }
  if (digits.length < 8 || digits.length > 15) return { ok: false, reason: "That number is the wrong length — check the digits." };
  return { ok: true, digits };
}

export function normalizePhone(input: string): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Enter a phone number." };
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "Enter a phone number." };

  if (raw.startsWith("+")) return international(digits);
  if (digits.startsWith("00")) return international(digits.slice(2));
  if (/^[6-9]\d{9}$/.test(digits)) return { ok: true, digits: INDIA + digits };
  if (/^0[6-9]\d{9}$/.test(digits)) return { ok: true, digits: INDIA + digits.slice(1) };
  if (/^91[6-9]\d{9}$/.test(digits)) return { ok: true, digits };
  return { ok: false, reason: HELP };
}

// "919876543210" → "+91 98765 43210"; other countries are shown as +digits.
export function formatPhone(digits: string): string {
  if (/^91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

// WhatsApp caps what a link can carry; longer messages are cut rather than broken.
const MAX_TEXT = 1500;

export function whatsappUrl(digits: string, text: string): string {
  const message = (text ?? "").trim().slice(0, MAX_TEXT);
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
