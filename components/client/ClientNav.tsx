"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { NotificationsBell } from "@/components/client/NotificationsBell";
import type { Notification } from "@/types/database";

export function ClientNav({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/app/dashboard";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/app/dashboard">
            <Logo subtitle={false} />
          </Link>
          {!isDashboard && (
            <Link
              href="/app/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <NotificationsBell notifications={notifications} />
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
