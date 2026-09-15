import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import { ShieldCheck, Workflow, ClipboardCheck, BarChart3, Radar, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PLAN_DISPLAY, formatInr } from "@/lib/constants/plans";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });

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
    <main className={`${display.variable} overflow-x-hidden`}>
      <header className="sticky top-0 z-20 border-b border-ink-100/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
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

      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] overflow-hidden"
        >
          <svg
            className="absolute left-1/2 top-[-120px] h-[820px] w-[820px] -translate-x-1/2 text-brand-600/[0.06]"
            viewBox="0 0 800 800"
            fill="none"
          >
            {[110, 210, 310, 410].map((r) => (
              <circle key={r} cx="400" cy="400" r={r} stroke="currentColor" strokeWidth="1.5" />
            ))}
          </svg>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-50" />
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Radar className="h-3.5 w-3.5" />
            AI Digital Marketing Autopilot
          </div>
          <h1
            className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 text-wrap-balance sm:text-6xl"
            style={{ textWrap: "balance" }}
          >
            One control center for your business&apos;s{" "}
            <span className="relative inline text-brand-600">
              organic digital marketing
              <svg
                aria-hidden
                viewBox="0 0 300 12"
                className="pointer-events-none absolute -bottom-1 left-0 hidden h-2.5 w-full text-brand-200 sm:block"
                preserveAspectRatio="none"
              >
                <path d="M2 9C60 3 240 3 298 9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-500">
            Digital Command connects your website and marketing channels, runs safe organic automation, and keeps you
            in control — with a full audit trail and proof of every action.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary group px-6 py-3 text-base">
              Register Your Business
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-transparent p-4 transition hover:-translate-y-0.5 hover:border-ink-100 hover:shadow-sm"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 font-semibold text-ink-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-900">
            Packages
          </h2>
          <p className="mt-2 text-sm text-ink-500">Every SMO package includes Facebook, Instagram, and YouTube.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {Object.entries(PLAN_DISPLAY).map(([code, plan]) => {
            const featured = code === "package_b";
            return (
              <div
                key={code}
                className={`relative flex flex-col rounded-xl border p-6 shadow-sm transition hover:-translate-y-1 ${
                  featured ? "border-brand-600 bg-white shadow-md ring-1 ring-brand-600" : "border-ink-100 bg-white"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                <p className="mb-4 text-sm text-ink-500">{plan.tagline}</p>
                <ul className="mb-5 space-y-2 text-sm text-ink-600">
                  {plan.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto space-y-1.5 border-t border-ink-100 pt-4 text-sm [font-variant-numeric:tabular-nums]">
                  <div className="flex justify-between">
                    <span className="text-ink-500">Quarterly</span>
                    <span className="font-semibold text-ink-900">{formatInr(plan.pricing.quarterly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Half-Yearly</span>
                    <span className="font-semibold text-ink-900">{formatInr(plan.pricing.half_yearly)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-ink-500">Yearly</span>
                    <span className="text-base font-bold text-ink-900">{formatInr(plan.pricing.yearly)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <Logo subtitle={false} />
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} Visionary Masters Global Pvt. Ltd. — Digital Command
          </p>
        </div>
      </footer>
    </main>
  );
}
