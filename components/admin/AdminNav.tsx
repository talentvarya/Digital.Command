"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Wallet, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Logo subtitle={false} />
          <nav className="flex items-center gap-1">
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith("/admin/dashboard") || pathname.startsWith("/admin/clients")
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/admin/costs"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith("/admin/costs") ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              <Wallet className="h-4 w-4" />
              Costs
            </Link>
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </header>
  );
}
