import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <h1 className="mb-6 text-xl font-bold text-ink-900">Log in</h1>
          <LoginForm />
          <div className="mt-4 flex justify-between text-sm">
            <Link href="/forgot-password" className="text-brand-600 hover:underline">
              Forgot password?
            </Link>
            <Link href="/register" className="text-brand-600 hover:underline">
              Register
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
