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

export interface LastCronRun {
  ran_at: string;
  ok: boolean;
  error: string | null;
  summary: unknown;
}

// `tableMissing` is true when the query itself failed (most often: migration
// 0035 not applied yet) — callers show a hint instead of treating it as a failed job.
export async function getLastCronRun(
  supabase: SupabaseClient,
  job: string
): Promise<{ last: LastCronRun | null; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from("cron_runs")
    .select("ran_at, ok, error, summary")
    .eq("job", job)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { last: (data as LastCronRun | null) ?? null, tableMissing: Boolean(error) };
}
