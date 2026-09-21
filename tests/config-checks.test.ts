import { describe, expect, it } from "vitest";
import { cronHealth, getConfigChecks, missingRequired } from "@/lib/admin/config-checks";

const FULL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_SITE_URL: "https://digital-command.vercel.app",
  CRON_SECRET: "secret",
  ANTHROPIC_API_KEY: "sk-ant",
};

describe("getConfigChecks / missingRequired", () => {
  it("reports nothing missing when every required setting is present", () => {
    expect(missingRequired(getConfigChecks(FULL_ENV))).toEqual([]);
  });

  it("flags exactly the required settings that are absent", () => {
    const { SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, ...env } = FULL_ENV;
    void SUPABASE_SERVICE_ROLE_KEY;
    void CRON_SECRET;
    expect(missingRequired(getConfigChecks(env)).map((c) => c.key)).toEqual(["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"]);
  });

  it("treats a blank or whitespace-only value as missing", () => {
    const missing = missingRequired(getConfigChecks({ ...FULL_ENV, CRON_SECRET: "   ", SUPABASE_SERVICE_ROLE_KEY: "" }));
    expect(missing.map((c) => c.key)).toEqual(["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"]);
  });

  it("requires the AI key of whichever provider is active", () => {
    const { ANTHROPIC_API_KEY, ...withoutAi } = FULL_ENV;
    void ANTHROPIC_API_KEY;
    expect(missingRequired(getConfigChecks({ ...withoutAi, AI_PROVIDER: "gemini" })).map((c) => c.key)).toEqual(["GEMINI_API_KEY"]);
    expect(missingRequired(getConfigChecks({ ...withoutAi, AI_PROVIDER: "openai" })).map((c) => c.key)).toEqual(["OPENAI_API_KEY"]);
    expect(missingRequired(getConfigChecks({ ...withoutAi, AI_PROVIDER: "gemini", GEMINI_API_KEY: "g" }))).toEqual([]);
  });

  it("defaults to the Anthropic key when AI_PROVIDER is unset or unrecognised", () => {
    const { ANTHROPIC_API_KEY, ...withoutAi } = FULL_ENV;
    void ANTHROPIC_API_KEY;
    expect(missingRequired(getConfigChecks(withoutAi)).map((c) => c.key)).toEqual(["ANTHROPIC_API_KEY"]);
    expect(missingRequired(getConfigChecks({ ...withoutAi, AI_PROVIDER: "kimi" })).map((c) => c.key)).toEqual(["ANTHROPIC_API_KEY"]);
  });

  it("never treats optional features as required, and needs BOTH halves of a paired setting", () => {
    const checks = getConfigChecks({ ...FULL_ENV, GOOGLE_CLIENT_ID: "only-the-id" });
    const google = checks.find((c) => c.key.startsWith("GOOGLE_CLIENT_ID"));
    expect(google?.required).toBe(false);
    expect(google?.set).toBe(false);
    expect(missingRequired(checks)).toEqual([]);
  });

  it("never includes a setting's value in its output", () => {
    const serialized = JSON.stringify(getConfigChecks({ ...FULL_ENV, BUFFER_ACCESS_TOKEN: "super-secret-token" }));
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("sk-ant");
  });
});

describe("cronHealth", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

  it("is never_run when nothing has been recorded", () => {
    expect(cronHealth(null, now)).toBe("never_run");
  });

  it("is failed when the last run failed, however recent", () => {
    expect(cronHealth({ ran_at: hoursAgo(1), ok: false }, now)).toBe("failed");
  });

  it("is healthy for a recent successful run", () => {
    expect(cronHealth({ ran_at: hoursAgo(20), ok: true }, now)).toBe("healthy");
  });

  it("is stale once a daily job has missed a full cycle plus grace", () => {
    expect(cronHealth({ ran_at: hoursAgo(36), ok: true }, now)).toBe("healthy");
    expect(cronHealth({ ran_at: hoursAgo(37), ok: true }, now)).toBe("stale");
  });
});
