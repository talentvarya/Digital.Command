import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { AccountForm } from "@/components/registration/AccountForm";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirect } from "@/lib/auth/redirect";

export default async function RegisterPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getPostLoginRedirect(supabase, user.id));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="mb-1 text-xl font-bold text-ink-900">Create your account</h1>
          <p className="mb-6 text-sm text-ink-500">Step 1 of 2 — business details come next.</p>
          <AccountForm />
          <div className="mt-4 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
