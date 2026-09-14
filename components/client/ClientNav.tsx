"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

export function ClientNav() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo subtitle={false} />
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </header>
  );
}
