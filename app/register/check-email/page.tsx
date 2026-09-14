import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function CheckEmailPage({ searchParams }: { searchParams: { email?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-ink-900">Confirm your email</h1>
          <p className="mb-6 text-sm text-ink-500">
            We sent a confirmation link{searchParams.email ? ` to ${searchParams.email}` : ""}. Click it, then log
            in to continue your registration.
          </p>
          <Link href="/login" className="btn-primary w-full">
            Go to login
          </Link>
        </div>
      </div>
    </main>
  );
}
