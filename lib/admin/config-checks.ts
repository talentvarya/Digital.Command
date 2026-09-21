// Which deployment settings are present. Presence only — a value is never
// returned, logged, or rendered. Exists because five separate production
// outages this project has had were all "an env var / dashboard setting was
// never added" (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, BUFFER_ACCESS_TOKEN,
// Secret-typed NEXT_PUBLIC vars, the Supabase Site URL), and each one was
// invisible until someone clicked the broken feature.
export interface ConfigCheck {
  key: string;
  label: string;
  required: boolean;
  set: boolean;
  ifMissing: string;
}

type Env = Record<string, string | undefined>;

const has = (env: Env, key: string) => Boolean(env[key]?.trim());

export function getConfigChecks(env: Env): ConfigCheck[] {
  const provider = (env.AI_PROVIDER ?? "").trim().toLowerCase() || "anthropic";
  const aiKey = provider === "gemini" ? "GEMINI_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";

  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase project URL",
      required: true,
      set: has(env, "NEXT_PUBLIC_SUPABASE_URL"),
      ifMissing: "Every page fails. (If it's set but still fails, it was saved as a Vercel \"Secret\" — re-add it as Config.)",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      required: true,
      set: has(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      ifMissing: "Every page fails.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase service-role key",
      required: true,
      set: has(env, "SUPABASE_SERVICE_ROLE_KEY"),
      ifMissing: "The public roadmap form and the nightly Autopilot job both fail.",
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      label: "Site URL",
      required: true,
      set: has(env, "NEXT_PUBLIC_SITE_URL"),
      ifMissing: "Google connect and redirect links point to the wrong address.",
    },
    {
      key: "CRON_SECRET",
      label: "Cron secret",
      required: true,
      set: has(env, "CRON_SECRET"),
      ifMissing: "The nightly Autopilot job is rejected (401) and never runs.",
    },
    {
      key: aiKey,
      label: `AI key for the active provider (${provider})`,
      required: true,
      set: has(env, aiKey),
      ifMissing: "Every AI feature — captions, reports, drafts, the assistant — errors.",
    },
    {
      key: "BUFFER_ACCESS_TOKEN",
      label: "Buffer access token",
      required: false,
      set: has(env, "BUFFER_ACCESS_TOKEN"),
      ifMissing: "Facebook/Instagram posts are never sent to Buffer; content stays \"Scheduled\".",
    },
    {
      key: "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET",
      label: "Google OAuth (client id and secret)",
      required: false,
      set: has(env, "GOOGLE_CLIENT_ID") && has(env, "GOOGLE_CLIENT_SECRET"),
      ifMissing: "Search Console, Analytics and YouTube can't be connected.",
    },
    {
      key: "TOKEN_ENCRYPTION_KEY",
      label: "Token encryption key",
      required: false,
      set: has(env, "TOKEN_ENCRYPTION_KEY"),
      ifMissing:
        "Google and Apify tokens saved from now on are stored as readable text in the database instead of encrypted (recommended).",
    },
    {
      key: "UNSPLASH_ACCESS_KEY",
      label: "Unsplash access key",
      required: false,
      set: has(env, "UNSPLASH_ACCESS_KEY"),
      ifMissing: "Planner posts don't get an automatic stock photo.",
    },
    {
      key: "GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_ENGINE_ID",
      label: "Google Custom Search (brand-mention search)",
      required: false,
      set: has(env, "GOOGLE_CUSTOM_SEARCH_API_KEY") && has(env, "GOOGLE_CUSTOM_SEARCH_ENGINE_ID"),
      ifMissing: "Brand-mention search in Off-Page & Outreach is unavailable.",
    },
    {
      key: "NEXT_PUBLIC_VMG_WHATSAPP_NUMBER",
      label: "VMG WhatsApp number",
      required: false,
      set: has(env, "NEXT_PUBLIC_VMG_WHATSAPP_NUMBER"),
      ifMissing: "The roadmap page's WhatsApp button stays disabled (\"coming soon\").",
    },
    {
      key: "NEXT_PUBLIC_VMG_PHONE",
      label: "VMG phone number",
      required: false,
      set: has(env, "NEXT_PUBLIC_VMG_PHONE"),
      ifMissing: "The roadmap page's \"Call now\" button falls back to email.",
    },
  ];
}

export function missingRequired(checks: ConfigCheck[]): ConfigCheck[] {
  return checks.filter((c) => c.required && !c.set);
}

// A daily job is "stale" once it has missed a full cycle plus a grace window.
export const CRON_STALE_AFTER_HOURS = 36;

export type CronHealth = "never_run" | "failed" | "stale" | "healthy";

export function cronHealth(lastRun: { ran_at: string; ok: boolean } | null, now: Date = new Date()): CronHealth {
  if (!lastRun) return "never_run";
  if (!lastRun.ok) return "failed";
  const ageHours = (now.getTime() - new Date(lastRun.ran_at).getTime()) / 3_600_000;
  return ageHours > CRON_STALE_AFTER_HOURS ? "stale" : "healthy";
}
