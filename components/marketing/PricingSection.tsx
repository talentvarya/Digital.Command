"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_DISPLAY, formatInr } from "@/lib/constants/plans";

type Term = "quarterly" | "half_yearly" | "yearly";

const TERM_LABELS: Record<Term, string> = { quarterly: "Quarterly", half_yearly: "Half-Yearly", yearly: "Yearly" };
const TERM_SUFFIX: Record<Term, string> = { quarterly: "/ quarter", half_yearly: "/ half-yearly", yearly: "/ year" };

// Extra marketing bullets beyond the two core lines PLAN_DISPLAY already
// carries (that constant is shared with the registration flow's package
// picker, so it stays minimal there — these are homepage-only framing).
const EXTRA_INCLUDES: Record<string, string[]> = {
  package_a: ["Brand Brain & guardrails", "7-Day Content Planner", "SEO audit & reports"],
  package_b: ["Everything in Package A", "Multi-property health", "Priority support"],
  custom: ["Per-brand guardrails", "Dedicated onboarding", "Custom audit & SLA"],
};

export function PricingSection() {
  const [term, setTerm] = useState<Term>("half_yearly");

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-4 flex justify-center">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            Pricing
          </span>
        </div>
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-ink-900">
          Simple packages, no surprises
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink-500">
          Every SMO package includes Facebook, Instagram, and YouTube.
        </p>

        <div className="mx-auto mt-8 flex w-fit overflow-hidden rounded-full border border-ink-200 bg-white p-1">
          {(Object.keys(TERM_LABELS) as Term[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTerm(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                term === t ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {TERM_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {Object.entries(PLAN_DISPLAY).map(([code, plan]) => {
            const featured = code === "package_a";
            const price = plan.pricing[term];
            return (
              <div
                key={code}
                className={`relative flex flex-col rounded-2xl border p-6 transition hover:-translate-y-1 ${
                  featured ? "border-brand-600 bg-white shadow-lg ring-1 ring-brand-600" : "border-ink-100 bg-white shadow-sm"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-brand-600 to-cyan-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                <p className="mb-4 text-sm text-ink-500">{plan.tagline}</p>
                <div className="mb-4 [font-variant-numeric:tabular-nums]">
                  <span className="font-display text-3xl font-bold text-ink-900">{formatInr(price)}</span>
                  {price !== null && <span className="ml-1 text-sm text-ink-400">{TERM_SUFFIX[term]}</span>}
                </div>
                <ul className="mb-6 space-y-2 text-sm text-ink-600">
                  {[...plan.includes, ...(EXTRA_INCLUDES[code] ?? [])].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href={code === "custom" ? "mailto:hello@visionarymastersglobal.com" : "/register"}
                  className={`mt-auto text-center ${featured ? "btn-primary" : "btn-secondary"}`}
                >
                  {code === "custom" ? "Talk to us" : "Get Started"}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">
          All prices in INR. Paid advertising budgets are separate and never charged automatically.
        </p>
      </div>
    </section>
  );
}
