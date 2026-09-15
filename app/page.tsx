import Link from "next/link";
import {
  ShieldCheck,
  Workflow,
  ClipboardCheck,
  BarChart3,
  Radar,
  ArrowRight,
  Palette,
  ClipboardList,
  Search,
  FileBarChart,
  Handshake,
  Megaphone,
  Sparkles,
  MousePointerClick,
  HeartPulse,
  Link2,
  SlidersHorizontal,
  ClipboardCheck as ReviewIcon,
  LineChart,
  Lightbulb,
  Building2,
  Users,
  Briefcase,
  Ban,
  FileCheck2,
  EyeOff,
  Octagon,
  CircleDot,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { DashboardMockup } from "@/components/marketing/DashboardMockup";

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

const MODULES = [
  { category: "Strategy", icon: Palette, title: "Brand Brain", short: "Business context, visual identity, tone & guardrails.", long: "Teach Digital Command who you are once. Every draft respects your voice, values, and approved examples." },
  { category: "Content", icon: ClipboardList, title: "7-Day Content Planner", short: "Plan a week with Approval Required or Autopilot.", long: "A rolling week of content with clear Draft, Scheduled, Approved and Autopilot states." },
  { category: "Growth", icon: Search, title: "SEO Technical Audit", short: "Prioritized issues with severity & next steps.", long: "Search Console, Analytics, keyword tracking and crawl findings ranked by impact." },
  { category: "Measurement", icon: FileBarChart, title: "Reports", short: "Built from connected data, never invented.", long: "Scorecards, trends and clearly-labelled sources with honest 'data unavailable' states." },
  { category: "Growth", icon: Handshake, title: "Off-Page & Outreach", short: "Opportunity assessment & drafted outreach.", long: "Conservative, relevant opportunities — external sending always stays manual." },
  { category: "Growth", icon: Megaphone, title: "Paid Advertising", short: "Briefs, budgets, dates — manual launch only.", long: "Campaign briefs prepared for you. No spend ever starts without your explicit approval." },
  { category: "System", icon: Sparkles, title: "AI Assistant", short: "Approval-aware help across every module.", long: "Ask for reports, edits and plans. The assistant respects your Brand Brain and guardrails." },
  { category: "Measurement", icon: MousePointerClick, title: "Conversions", short: "Trackable link & funnel reporting.", long: "See the journey from click to conversion, with honest gaps where upstream data is missing." },
  { category: "System", icon: HeartPulse, title: "Connection Health", short: "Know exactly what's connected & healthy.", long: "Distinguish connected, healthy, configured, missing, not added, and needs-reconnecting." },
];

const STEPS = [
  { icon: Link2, title: "Connect", body: "Link your website, Search Console, Analytics, and social channels." },
  { icon: SlidersHorizontal, title: "Set guardrails", body: "Define your Brand Brain, tone, and choose Approval Required or Autopilot." },
  { icon: ClipboardList, title: "Plan", body: "Get a 7-day content plan and prioritized growth actions." },
  { icon: ReviewIcon, title: "Review / approve", body: "Approve, edit, or let Autopilot handle what you've authorized." },
  { icon: LineChart, title: "Track", body: "Watch conversions, rankings, and reports from real connected data." },
  { icon: Lightbulb, title: "Improve", body: "The assistant suggests the next best conservative move." },
];

const PERSONAS = [
  { icon: Briefcase, label: "Business Owners", headline: "Marketing that runs itself — with you in command.", points: ["No agency jargon", "One weekly review", "Approve from your phone", "Clear proof of ROI"] },
  { icon: Users, label: "In-House Marketers", headline: "A force multiplier that respects your brand.", points: ["Drafts in your tone", "Prioritized SEO backlog", "Report automation", "Full change history"] },
  { icon: Building2, label: "Agencies & Multi-Brand Teams", headline: "Scale organic work across every client safely.", points: ["Per-brand guardrails", "Attributable actions", "Autopilot where trusted", "Auditable delivery"] },
];

const INTEGRATIONS = [
  { name: "Google Search Console", live: true },
  { name: "Google Analytics 4", live: true },
  { name: "YouTube", live: true },
  { name: "Website Crawl", live: true },
  { name: "Facebook", live: true },
  { name: "Instagram", live: true },
  { name: "Google Ads", live: false },
  { name: "Meta Ads", live: false },
];

const TRUST_POINTS = [
  { icon: FileCheck2, title: "Approval-first by default", body: "Content and outreach wait for your approval unless you explicitly enable Autopilot for a workflow." },
  { icon: Ban, title: "No automatic ad spend", body: "Paid campaigns are prepared as briefs. Launch and budget always require an explicit human action." },
  { icon: ClipboardCheck, title: "Complete audit trail", body: "Every action records who did it — you, your team, our admins, Autopilot, or the assistant — and when." },
  { icon: ShieldCheck, title: "Platform-compliant", body: "We avoid spam, manipulative links, and guaranteed-ranking claims. Automation stays conservative." },
  { icon: EyeOff, title: "Honest data states", body: "Where an integration is missing or partial, we say so — we never fabricate metrics or connections." },
  { icon: Octagon, title: "Master STOP control", body: "A single control pauses all automation instantly. You are never locked out of the driver's seat." },
];

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <div className="bg-ink-950 px-4 py-2 text-center text-xs font-medium text-white/70">
        <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-cyan-400" />
        Safety-first automation — nothing publishes and no ad spend starts without your approval.
      </div>

      <header className="sticky top-0 z-20 border-b border-ink-100/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(61,90,254,0.25), transparent 45%), radial-gradient(circle at 85% 25%, rgba(34,211,238,0.18), transparent 40%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-8">
          <div>
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-300">
              <Radar className="h-3.5 w-3.5" />
              AI Digital Marketing Autopilot
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl" style={{ textWrap: "balance" }}>
              One control center for your business&apos;s{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(92deg, #3d5afe 0%, #5b7bff 45%, #22d3ee 100%)" }}
              >
                organic digital marketing
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Digital Command connects your website and marketing channels, runs safe organic automation, and keeps
              you in control — with a full audit trail and proof of every action.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary group px-6 py-3 text-base">
                Register Your Business
                <ArrowRight className="ml-1.5 inline h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Log in
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/50">
              {["Approval-first", "Full audit trail", "No auto ad-spend", "Platform-compliant"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CircleDot className="h-3 w-3 text-cyan-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <DashboardMockup />
        </div>
      </section>

      {/* 4-up feature strip */}
      <section className="border-b border-ink-100 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-xl border border-transparent p-4 transition hover:-translate-y-0.5 hover:border-ink-100 hover:shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 font-semibold text-ink-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9 modules */}
      <section className="bg-ink-50/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              One platform, nine modules
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
              Everything your organic marketing needs — in command
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Each module works with your Brand Brain and approval guardrails, so the whole system stays consistent,
              safe, and accountable.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.title} className="rounded-xl border border-ink-100 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="mb-3 inline-block rounded-full bg-ink-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  {m.category}
                </span>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <m.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mb-1 font-semibold text-ink-900">{m.title}</h3>
                <p className="mb-1.5 text-sm font-medium text-ink-700">{m.short}</p>
                <p className="text-sm leading-relaxed text-ink-500">{m.long}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-ink-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
              How it works
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight">A safe, repeatable loop — always in your control</h2>
            <p className="mt-2 text-sm text-white/60">
              Six steps from connecting your channels to compounding, measurable results. Every step is transparent
              and reversible.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-cyan-400">STEP {i + 1}</span>
                </div>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-cyan-300">
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mb-1 font-semibold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Personas */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              Built for how you work
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">One command center, three ways to win</h2>
            <p className="mt-2 text-sm text-ink-500">
              Whether you own the business, run marketing in-house, or manage many brands — Digital Command adapts to
              your level of control.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PERSONAS.map((p) => (
              <div key={p.label} className="rounded-2xl border border-ink-100 bg-ink-50/40 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <p.icon className="h-5 w-5" />
                </div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-brand-600">{p.label}</span>
                <p className="mb-4 font-display text-lg font-bold leading-snug text-ink-900">{p.headline}</p>
                <ul className="space-y-1.5 text-sm text-ink-600">
                  {p.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-brand-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-ink-50/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              Integrations
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Connect what you already use</h2>
            <p className="mt-2 text-sm text-ink-500">
              We only show connections that are live today, and clearly label what&apos;s coming next — no misleading
              &apos;available now&apos; claims.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3">
                <span className="text-sm font-medium text-ink-800">{i.name}</span>
                {i.live ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Coming soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />

      {/* Trust & safety */}
      <section className="bg-ink-50/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              Trust, safety &amp; auditability
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
              Powerful automation you can actually trust
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Digital Command is designed so you&apos;re never surprised. Control, transparency, and accountability
              are built into every workflow.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_POINTS.map((t) => (
              <div key={t.title} className="rounded-xl border border-ink-100 bg-white p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <t.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mb-1 font-semibold text-ink-900">{t.title}</h3>
                <p className="text-sm leading-relaxed text-ink-500">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              FAQ
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Answers, before you ask</h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-ink-950 py-20 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ backgroundImage: "radial-gradient(circle at 50% 0%, rgba(61,90,254,0.25), transparent 55%)" }}
        />
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Take command of your organic marketing</h2>
          <p className="mx-auto mt-4 max-w-lg text-white/70">
            Register your business, connect your channels, and set your guardrails. You stay in control at every
            step — with proof of every action.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Register Your Business
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
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
