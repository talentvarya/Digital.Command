import Link from "next/link";
import { Radar } from "lucide-react";
import { RoadmapLeadForm } from "@/components/roadmap/RoadmapLeadForm";

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Radar className="h-5 w-5" />
            </span>
            <div className="text-lg font-bold tracking-tight text-white">
              DIGITAL <span className="text-brand-400">COMMAND</span>
            </div>
          </Link>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <RoadmapLeadForm />
      </div>
    </main>
  );
}
