import Link from "next/link";
import { ShieldCheck, Workflow, ClipboardCheck, BarChart3 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PLAN_DISPLAY, formatInr } from "@/lib/constants/plans";

const FEATURES = [
  {
    icon: Workflow,
    title: "Autopilot or Approval Required",
    body: "Choose how much control you keep. Nothing publishes without your say-so unless you turn Autopilot on.",
  },
  {
    icon: ShieldCheck,
    title: "Paid ads never start on their own",
    body: "Paid Google, Meta, and YouTube campaigns always require your explicit approval before any spend.",
  },
  {
    icon: ClipboardCheck,
    title: "Every action, attributed and logged",
    body: "A complete audit trail — Autopilot, your team, our admins, or the AI assistant — so nothing is ever ambiguous.",
  },
  {
    icon: BarChart3,
    title: "Built for safety and compliance first",
    body: "Conservative, platform-compliant automation — no spam, no manipulative links, no guaranteed-rankings promises.",
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
            <Link href="/register" className="btn-primary">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
          One control center for your business&apos;s <span className="text-brand-600">organic digital marketing</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-500">
          Digital Command connects your website and marketing channels, runs safe organic automation, and keeps you
          in control — with a full audit trail and proof of every action.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Register Your Business
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">
            Log in
          </Link>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 font-semibold text-ink-900">{f.title}</h3>
              <p className="text-sm text-ink-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="mb-2 text-center text-2xl font-bold text-ink-900">Packages</h2>
        <p className="mb-10 text-center text-sm text-ink-500">
          Every SMO package includes Facebook, Instagram, and YouTube.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {Object.entries(PLAN_DISPLAY).map(([code, plan]) => (
            <div key={code} className="card">
              <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
              <p className="mb-4 text-sm text-ink-500">{plan.tagline}</p>
              <ul className="mb-4 space-y-1 text-sm text-ink-600">
                {plan.includes.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-ink-100 pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-500">Quarterly</span>
                  <span className="font-semibold text-ink-900">{formatInr(plan.pricing.quarterly)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Half-Yearly</span>
                  <span className="font-semibold text-ink-900">{formatInr(plan.pricing.half_yearly)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Yearly</span>
                  <span className="font-semibold text-ink-900">{formatInr(plan.pricing.yearly)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8 text-center text-xs text-ink-400">
        © {new Date().getFullYear()} Visionary Masters Global Pvt. Ltd. — Digital Command
      </footer>
    </main>
  );
}
