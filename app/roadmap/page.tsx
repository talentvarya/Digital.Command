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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            <Radar className="h-3.5 w-3.5" />
            Free — 2 minute
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ textWrap: "balance" }}>
            Apne business ka free AI Growth Roadmap paayein
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Kuch details bhariye, AI turant aapke business ke liye ek personalized 90-din ka roadmap bana kar dikhayega — bilkul free, koi obligation nahi.
          </p>
        </div>

        <RoadmapLeadForm />
      </div>
    </main>
  );
}
