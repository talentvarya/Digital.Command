import { describe, expect, it, vi } from "vitest";
import { cleanFreeText, tryWithOptionalColumn } from "@/lib/planner/optional-column";

// What a Supabase write resolves to, as far as the helper cares.
type Result = { error: { message: string } | null; saved: string };
const ok = (saved: string): Result => ({ error: null, saved });
const fail = (message: string): Result => ({ error: { message }, saved: "nothing" });

describe("tryWithOptionalColumn", () => {
  it("uses the write with the new column when the database accepts it", async () => {
    const withColumn = vi.fn(async () => ok("with"));
    const withoutColumn = vi.fn(async () => ok("without"));
    const result = await tryWithOptionalColumn("image_prompt", withColumn, withoutColumn);
    expect(result.saved).toBe("with");
    expect(withoutColumn).not.toHaveBeenCalled();
  });

  it("repeats the write without the column when the database says that column doesn't exist yet", async () => {
    const withColumn = vi.fn(async () => fail('column "image_prompt" of relation "content_items" does not exist'));
    const withoutColumn = vi.fn(async () => ok("without"));
    const result = await tryWithOptionalColumn("image_prompt", withColumn, withoutColumn);
    expect(result.saved).toBe("without");
    expect(withColumn).toHaveBeenCalledOnce();
  });

  it("does NOT hide an unrelated failure behind the fallback", async () => {
    const withoutColumn = vi.fn(async () => ok("without"));
    const result = await tryWithOptionalColumn(
      "image_prompt",
      async () => fail("new row violates row-level security policy"),
      withoutColumn
    );
    expect(result.error?.message).toMatch(/row-level security/);
    expect(withoutColumn).not.toHaveBeenCalled();
  });

  it("returns the fallback's own error if that fails too", async () => {
    const result = await tryWithOptionalColumn(
      "image_prompt",
      async () => fail("column image_prompt does not exist"),
      async () => fail("connection lost")
    );
    expect(result.error?.message).toBe("connection lost");
  });
});

describe("cleanFreeText", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(cleanFreeText("  a   b\n\nc ", 50)).toBe("a b c");
    expect(cleanFreeText("x".repeat(600), 500)).toHaveLength(500);
  });

  it("treats empty and non-text values as nothing", () => {
    expect(cleanFreeText("   ", 50)).toBeNull();
    expect(cleanFreeText(null, 50)).toBeNull();
    expect(cleanFreeText(undefined, 50)).toBeNull();
    expect(cleanFreeText(42, 50)).toBeNull();
  });
});
