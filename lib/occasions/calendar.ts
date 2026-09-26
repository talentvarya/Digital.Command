import { addDays } from "@/lib/utils/ist";

// Indian festivals and business occasions, so the planner can say "Diwali is in
// 12 days — plan your post" instead of leaving a business to remember. Dates
// that follow the lunar calendar can't be worked out by a rule, so they are
// written out below; the ones that repeat on the same date or the same weekday
// every year are worked out. Everything here is a date and a one-line angle —
// nothing is claimed about any business.

export type OccasionKind = "festival" | "national" | "seasonal";

export interface Occasion {
  key: string;
  name: string;
  hindi?: string;
  date: string; // YYYY-MM-DD
  kind: OccasionKind;
  // worth prompting a business about (the big commercial moments)
  major: boolean;
  // Dates set by moon sighting can move by a day.
  approximate?: boolean;
  // A general, respectful marketing angle — also given to the AI as context.
  angle: string;
}

// ---------------------------------------------------------------------------
// Dates that follow the lunar calendar (Delhi reckoning) — checked against Drik
// Panchang and a second listing for each, 2026-09-26. Extend before the last one
// passes: the planner shows nothing for a period this list doesn't cover.
// ---------------------------------------------------------------------------
export const CALENDAR_COVERS_UNTIL = "2027-12-31";

interface LunarEntry {
  key: string;
  name: string;
  hindi?: string;
  dates: string[]; // one per year
  major: boolean;
  approximate?: boolean;
  angle: string;
}

const LUNAR: LunarEntry[] = [
  {
    key: "navratri",
    name: "Navratri begins",
    hindi: "नवरात्रि",
    dates: ["2026-10-11", "2027-09-30"],
    major: true,
    angle: "Nine nights of Durga — garba and dandiya, fasting food, ethnic wear and festive shopping.",
  },
  {
    key: "dussehra",
    name: "Dussehra",
    hindi: "दशहरा",
    dates: ["2026-10-20", "2027-10-09"],
    major: true,
    angle: "The victory of good over evil — a day when new purchases and new beginnings are considered auspicious.",
  },
  {
    key: "karwa-chauth",
    name: "Karwa Chauth",
    hindi: "करवा चौथ",
    dates: ["2026-10-29", "2027-10-18"],
    major: true,
    angle: "Married women fast for their husbands — gifts, jewellery, mehndi, sargi and festive outfits are popular.",
  },
  {
    key: "dhanteras",
    name: "Dhanteras",
    hindi: "धनतेरस",
    dates: ["2026-11-06", "2027-10-27"],
    major: true,
    angle: "The first day of Diwali, traditionally an auspicious day to buy gold, silver, utensils and new appliances.",
  },
  {
    key: "diwali",
    name: "Diwali",
    hindi: "दिवाली",
    dates: ["2026-11-08", "2027-10-29"],
    major: true,
    angle: "The festival of lights — the biggest gifting and shopping season of the year, with hampers, sweets, decor and family celebrations.",
  },
  {
    key: "govardhan-puja",
    name: "Govardhan Puja",
    hindi: "गोवर्धन पूजा",
    dates: ["2026-11-10", "2027-10-30"],
    major: false,
    angle: "The day after Diwali, also celebrated as the start of the new year in parts of India.",
  },
  {
    key: "bhai-dooj",
    name: "Bhai Dooj",
    hindi: "भाई दूज",
    dates: ["2026-11-11", "2027-10-31"],
    major: true,
    angle: "A festival for brothers and sisters — gifts, sweets and family get-togethers.",
  },
  {
    key: "guru-nanak-jayanti",
    name: "Guru Nanak Jayanti",
    hindi: "गुरु नानक जयंती",
    dates: ["2026-11-24", "2027-11-14"],
    major: false,
    approximate: true,
    angle: "Gurpurab, the birth anniversary of Guru Nanak — wishes, community service and langar.",
  },
  {
    key: "lohri",
    name: "Lohri",
    hindi: "लोहड़ी",
    dates: ["2027-01-14"],
    major: false,
    angle: "A winter harvest festival celebrated around bonfires, especially in Punjab and North India.",
  },
  {
    key: "makar-sankranti",
    name: "Makar Sankranti / Pongal",
    hindi: "मकर संक्रांति",
    dates: ["2027-01-15"],
    major: true,
    angle: "Harvest festivals across India — kites, til-gud sweets, and Pongal in the south.",
  },
  {
    key: "maha-shivaratri",
    name: "Maha Shivaratri",
    hindi: "महाशिवरात्रि",
    dates: ["2027-03-06"],
    major: false,
    angle: "A night of devotion to Lord Shiva — a day of fasting and prayer, so keep the tone respectful.",
  },
  {
    key: "eid-al-fitr",
    name: "Eid al-Fitr",
    hindi: "ईद",
    dates: ["2027-03-10"],
    major: true,
    approximate: true,
    angle: "Eid greetings, family feasts and gifting — the date follows the moon and can move by a day.",
  },
  {
    key: "holi",
    name: "Holi",
    hindi: "होली",
    dates: ["2027-03-22"],
    major: true,
    angle: "The festival of colours — sweets, gifting, party plans and colourful offers (Holika Dahan is the evening before).",
  },
  {
    key: "ugadi",
    name: "Ugadi / Gudi Padwa",
    hindi: "गुड़ी पड़वा",
    dates: ["2027-04-07"],
    major: false,
    angle: "New Year in Karnataka, Andhra Pradesh, Telangana and Maharashtra — a fresh start and festive shopping.",
  },
  {
    key: "baisakhi",
    name: "Baisakhi",
    hindi: "बैसाखी",
    dates: ["2027-04-14"],
    major: false,
    angle: "The harvest festival and Punjabi new year, also celebrated as Vishu and Puthandu in the south.",
  },
  {
    key: "ram-navami",
    name: "Ram Navami",
    hindi: "राम नवमी",
    dates: ["2027-04-15"],
    major: false,
    angle: "The birth of Lord Rama — a day of devotion; keep the tone respectful.",
  },
  {
    key: "eid-al-adha",
    name: "Eid al-Adha (Bakrid)",
    hindi: "बकरीद",
    dates: ["2027-05-17"],
    major: true,
    approximate: true,
    angle: "Eid greetings, family gatherings and gifting — the date follows the moon and can move by a day.",
  },
  {
    key: "raksha-bandhan",
    name: "Raksha Bandhan",
    hindi: "रक्षा बंधन",
    dates: ["2026-08-28", "2027-08-17"],
    major: true,
    angle: "Sisters tie rakhi on their brothers' wrists — rakhis, gifts, sweets and hampers are in demand.",
  },
  {
    key: "janmashtami",
    name: "Janmashtami",
    hindi: "जन्माष्टमी",
    dates: ["2027-08-25"],
    major: false,
    angle: "The birth of Lord Krishna — sweets, decorations and dahi-handi celebrations.",
  },
  {
    key: "ganesh-chaturthi",
    name: "Ganesh Chaturthi",
    hindi: "गणेश चतुर्थी",
    dates: ["2027-09-04"],
    major: true,
    angle: "Ganpati arrives — modaks and sweets, idols, decorations and community celebrations.",
  },
  {
    key: "onam",
    name: "Onam",
    hindi: "ओणम",
    dates: ["2027-09-12"],
    major: false,
    angle: "Kerala's harvest festival — the sadya feast, pookalam flower carpets and new clothes.",
  },
];

// ---------------------------------------------------------------------------
// Occasions that fall on the same date every year
// ---------------------------------------------------------------------------
interface FixedEntry {
  key: string;
  name: string;
  hindi?: string;
  month: number;
  day: number;
  kind: OccasionKind;
  major: boolean;
  angle: string;
}

const FIXED: FixedEntry[] = [
  { key: "new-year", name: "New Year's Day", month: 1, day: 1, kind: "seasonal", major: true, angle: "A fresh start — resolutions, new-year offers and thank-you messages to customers." },
  { key: "republic-day", name: "Republic Day", hindi: "गणतंत्र दिवस", month: 1, day: 26, kind: "national", major: true, angle: "A national day — patriotic themes and sale campaigns are common; keep the tone respectful." },
  { key: "valentines-day", name: "Valentine's Day", month: 2, day: 14, kind: "seasonal", major: true, angle: "Gifts, chocolates, flowers, dinners and experiences for couples." },
  { key: "womens-day", name: "International Women's Day", hindi: "महिला दिवस", month: 3, day: 8, kind: "seasonal", major: false, angle: "Celebrating women — thank-yous, stories and special offers." },
  { key: "independence-day", name: "Independence Day", hindi: "स्वतंत्रता दिवस", month: 8, day: 15, kind: "national", major: true, angle: "A national day — patriotic themes and sale campaigns are common; keep the tone respectful." },
  { key: "teachers-day", name: "Teachers' Day", hindi: "शिक्षक दिवस", month: 9, day: 5, kind: "seasonal", major: false, angle: "Thanking teachers — gifts and greetings." },
  { key: "gandhi-jayanti", name: "Gandhi Jayanti", hindi: "गांधी जयंती", month: 10, day: 2, kind: "national", major: false, angle: "A national day of remembrance; keep the tone respectful." },
  { key: "childrens-day", name: "Children's Day", hindi: "बाल दिवस", month: 11, day: 14, kind: "seasonal", major: false, angle: "Kids' offers, treats, toys and family outings." },
  { key: "christmas", name: "Christmas", hindi: "क्रिसमस", month: 12, day: 25, kind: "festival", major: true, angle: "Cakes, gifts, decorations, parties and family celebrations." },
  { key: "new-years-eve", name: "New Year's Eve", month: 12, day: 31, kind: "seasonal", major: true, angle: "Parties, year-end offers and thank-yous for the year gone by." },
];

// ---------------------------------------------------------------------------
// Occasions on the same weekday of the same month every year
// ---------------------------------------------------------------------------
// The date of the nth Sunday of a month (n = 1 is the first).
export function nthSunday(year: number, month: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
  return new Date(Date.UTC(year, month - 1, firstSunday + (n - 1) * 7)).toISOString().slice(0, 10);
}

// Easter Sunday (Western), by the standard anonymous Gregorian computus.
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ruleBased(year: number): Occasion[] {
  return [
    {
      key: "mothers-day",
      name: "Mother's Day",
      hindi: "मदर्स डे",
      date: nthSunday(year, 5, 2),
      kind: "seasonal",
      major: true,
      angle: "Gifts, cakes, flowers and thank-yous for mothers.",
    },
    {
      key: "fathers-day",
      name: "Father's Day",
      hindi: "फादर्स डे",
      date: nthSunday(year, 6, 3),
      kind: "seasonal",
      major: false,
      angle: "Gifts and thank-yous for fathers.",
    },
    {
      key: "friendship-day",
      name: "Friendship Day",
      hindi: "फ्रेंडशिप डे",
      date: nthSunday(year, 8, 1),
      kind: "seasonal",
      major: false,
      angle: "Friends' get-togethers, gifts and treats.",
    },
    {
      key: "good-friday",
      name: "Good Friday",
      date: addDays(easterSunday(year), -2),
      kind: "festival",
      major: false,
      angle: "A solemn day for Christian communities — keep the tone respectful.",
    },
    {
      key: "easter",
      name: "Easter",
      date: easterSunday(year),
      kind: "festival",
      major: false,
      angle: "Easter greetings, family lunches, cakes and chocolates.",
    },
  ];
}

// ---------------------------------------------------------------------------
// The whole list
// ---------------------------------------------------------------------------
function build(): Occasion[] {
  const all: Occasion[] = [];
  const years = [2026, 2027];

  for (const entry of LUNAR) {
    for (const date of entry.dates) {
      all.push({
        key: `${entry.key}-${date.slice(0, 4)}`,
        name: entry.name,
        hindi: entry.hindi,
        date,
        kind: "festival",
        major: entry.major,
        approximate: entry.approximate,
        angle: entry.angle,
      });
    }
  }
  for (const year of years) {
    for (const f of FIXED) {
      all.push({
        key: `${f.key}-${year}`,
        name: f.name,
        hindi: f.hindi,
        date: `${year}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`,
        kind: f.kind,
        major: f.major,
        angle: f.angle,
      });
    }
    for (const r of ruleBased(year)) all.push({ ...r, key: `${r.key}-${year}` });
  }
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export const OCCASIONS: Occasion[] = build();

// Occasions from `from` to `to`, both included (YYYY-MM-DD).
export function occasionsBetween(from: string, to: string, options: { majorOnly?: boolean } = {}): Occasion[] {
  return OCCASIONS.filter((o) => o.date >= from && o.date <= to && (!options.majorOnly || o.major));
}

export function findOccasion(key: string): Occasion | null {
  return OCCASIONS.find((o) => o.key === key) ?? null;
}

// Whole days from `today` to a date (0 = today).
export function daysAway(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function daysAwayLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
