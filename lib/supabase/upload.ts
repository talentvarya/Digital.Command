import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export async function uploadOrgFile(
  supabase: SupabaseClient,
  bucket: "verification-documents" | "payment-screenshots",
  orgId: string,
  file: File
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${orgId}/${randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed (${bucket}): ${error.message}`);
  return path;
}
