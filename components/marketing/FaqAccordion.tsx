"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Will Digital Command post or spend money without me?",
    a: "No. By default everything is Approval Required. Content publishes only when you approve it, and paid advertising never spends automatically — launch is always a manual, explicit action.",
  },
  {
    q: "What is the difference between Approval Required and Autopilot?",
    a: "Approval Required holds every AI-generated post for your review before it schedules. Autopilot auto-schedules what you've generated unless it trips a policy check (like a word you've told it to avoid) — that's held for your review instead. Either way, you choose which platforms Autopilot covers.",
  },
  {
    q: "How do you keep automation safe and compliant?",
    a: "Conservative, platform-compliant behavior by design — no spam, no manipulative links, no guaranteed-ranking claims. A Master STOP on your account pauses all automation instantly, and a platform-wide Emergency Freeze exists for our admins if something needs to stop everywhere at once.",
  },
  {
    q: "Where does the data in reports come from?",
    a: "Real connected sources only — your own Search Console, Analytics, and crawl data. If a connection is missing or a metric isn't available yet, the report says so plainly instead of inventing a number.",
  },
  {
    q: "Can my whole team use it, and can I see who did what?",
    a: "Yes — every action is attributed and logged, whether it came from you, your team, our admins, Autopilot, or the AI assistant, so there's never any ambiguity about who did what and when.",
  },
  {
    q: "What's included in an SMO package?",
    a: "Every package includes Facebook, Instagram, and YouTube social media optimization, plus Brand Brain guardrails, the 7-Day Content Planner, and SEO audits & reports. Package B doubles the websites and SMO packages; Custom / Enterprise is for more than two brands.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      {FAQS.map((item, i) => (
        <div key={item.q} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-ink-900"
            aria-expanded={open === i}
          >
            {item.q}
            <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && <p className="px-5 pb-4 text-sm leading-relaxed text-ink-600">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}
