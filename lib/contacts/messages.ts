// Ready-made WhatsApp messages for a business to send its own customers, and the
// small rules around them. The client opens each message in WhatsApp and presses
// send themselves — nothing here sends anything.

export interface MessageTemplate {
  key: string;
  title: string;
  language: "English" | "Hindi";
  text: string;
  // needs the business's own review page link (Reputation settings)
  needsReviewLink?: boolean;
}

// {name} and {business} are filled in for every customer. {details} is a gap
// the client fills in once (the offer, the wish, the date…) — a message still
// containing it is not sent. {review_link} is the business's Google review link.
export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    key: "offer",
    title: "Offer or announcement",
    language: "English",
    text: "Hi {name}, this is {business}. {details}\n\nReply to this message to order or ask anything.",
  },
  {
    key: "festival",
    title: "Festival wishes",
    language: "English",
    text: "Hi {name}, warm wishes from all of us at {business}! {details}",
  },
  {
    key: "thanks",
    title: "Thank you after a purchase",
    language: "English",
    text: "Hi {name}, thank you for choosing {business}! We hope you're happy with everything. If you have any question, just reply here.",
  },
  {
    key: "review",
    title: "Ask for a review",
    language: "English",
    text: "Hi {name}, thank you for choosing {business}! If you liked it, a quick review helps us a lot: {review_link}",
    needsReviewLink: true,
  },
  {
    key: "update",
    title: "Something new",
    language: "English",
    text: "Hi {name}, {business} here with something new: {details}",
  },
  {
    key: "reminder",
    title: "Reminder",
    language: "English",
    text: "Hi {name}, a reminder from {business}: {details}",
  },
  {
    key: "offer_hi",
    title: "Offer or announcement",
    language: "Hindi",
    text: "नमस्ते {name} जी, {business} की ओर से: {details}\n\nऑर्डर करने या कुछ पूछने के लिए इसी नंबर पर जवाब दें।",
  },
  {
    key: "festival_hi",
    title: "Festival wishes",
    language: "Hindi",
    text: "नमस्ते {name} जी, {business} परिवार की ओर से आपको हार्दिक शुभकामनाएँ! {details}",
  },
  {
    key: "thanks_hi",
    title: "Thank you after a purchase",
    language: "Hindi",
    text: "नमस्ते {name} जी, {business} को चुनने के लिए धन्यवाद! कोई भी सवाल हो तो इसी नंबर पर जवाब दें।",
  },
  {
    key: "review_hi",
    title: "Ask for a review",
    language: "Hindi",
    text: "नमस्ते {name} जी, {business} को चुनने के लिए धन्यवाद! अगर आपको पसंद आया हो तो एक छोटा-सा रिव्यू दें, हमारे लिए बहुत मायने रखता है: {review_link}",
    needsReviewLink: true,
  },
];

const KNOWN = new Set(["name", "business", "review_link"]);

// The first word of a saved name: "Ravi Sharma" → "Ravi".
export function firstName(name: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export interface MessageVars {
  name: string;
  business: string;
  reviewLink?: string | null;
}

export function renderMessage(text: string, vars: MessageVars): string {
  return text
    .replace(/\{name\}/g, firstName(vars.name) || "there")
    // "Aura Lux Chocolate Co." followed by the sentence's own full stop would read "Co.."
    .replace(/\{business\}(\.?)/g, (_match, dot: string) => (dot && vars.business.endsWith(".") ? vars.business : vars.business + dot))
    .replace(/\{review_link\}/g, vars.reviewLink ?? "")
    .trim();
}

// Placeholders left in the text that nothing fills in (like {details}); a message
// with any of them shouldn't go out.
export function unresolvedPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{([a-z_]+)\}/gi)) {
    if (!KNOWN.has(match[1].toLowerCase())) found.add(`{${match[1]}}`);
  }
  return [...found];
}

// Templates the business can actually use: the review ones need its review link.
export function availableTemplates(hasReviewLink: boolean): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter((t) => !t.needsReviewLink || hasReviewLink);
}

export interface AudienceContact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  consent: boolean;
  opted_out: boolean;
}

// Who a message may go to: people who agreed to hear from the business and have
// not since asked it to stop, optionally only those with one tag.
export function pickAudience<T extends AudienceContact>(
  contacts: T[],
  tag: string | null
): { sendable: T[]; withoutConsent: number; optedOut: number } {
  const inGroup = tag ? contacts.filter((c) => c.tags.includes(tag)) : contacts;
  const sendable = inGroup
    .filter((c) => c.consent && !c.opted_out)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    sendable,
    withoutConsent: inGroup.filter((c) => !c.consent && !c.opted_out).length,
    optedOut: inGroup.filter((c) => c.opted_out).length,
  };
}
