import type { SupabaseClient } from "@supabase/supabase-js";

// Logging must never be the thing that breaks the job it's logging: if the
// insert fails (table not migrated yet, transient DB error) the run still
// completes and the failure only goes to the server log.
export async function recordCronRun(
  supabase: SupabaseClient,
  job: string,
  run: { ok: boolean; summary?: unknown; error?: string | null }
): Promise<void> {
  const { error } = await supabase.from("cron_runs").insert({
    job,
    ok: run.ok,
    summary: run.summary ?? {},
    error: run.error ?? null,
  });
  if (error) console.error(`cron_runs insert failed for "${job}":`, error.message);
}
