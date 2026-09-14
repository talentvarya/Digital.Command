"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import { logAudit } from "@/lib/audit/log";
import type { ActionResult } from "@/app/register/actions";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { error: error?.message ?? "Invalid email or password" };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

  await logAudit(supabase, {
    actorUserId: data.user.id,
    actorRole: profile?.role ?? null,
    source: profile?.role === "super_admin" ? "ADMIN" : "CLIENT_MANUAL",
    actionType: "login",
    target: data.user.id,
  });

  const redirectTo = await getPostLoginRedirect(supabase, data.user.id);
  redirect(redirectTo);
}
