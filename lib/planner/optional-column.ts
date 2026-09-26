// A write that includes a column added by a recent migration would fail with
// "column ... does not exist" on a database that hasn't had that migration run
// yet — and because the code deploys before the SQL is run, that window is real.
// This runs the write with the new column first and, only if the database says
// that column is missing, repeats it without — so the old behaviour keeps working
// (the new field is just not saved) instead of breaking every edit.
export async function tryWithOptionalColumn<T extends { error: { message: string } | null }>(
  column: string,
  withColumn: () => PromiseLike<T>,
  withoutColumn: () => PromiseLike<T>
): Promise<T> {
  const first = await withColumn();
  if (first.error && first.error.message.includes(column)) return withoutColumn();
  return first;
}

// Free-text field from a form: trimmed, capped, and empty means "nothing".
export function cleanFreeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, max);
  return text || null;
}
