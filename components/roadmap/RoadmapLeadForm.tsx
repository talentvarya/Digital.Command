"use client";

import { useFormState, useFormStatus } from "react-dom";
import { MessageCircle, Phone, Sparkles, CheckCircle2 } from "lucide-react";
import { generateRoadmapLeadAction, type RoadmapActionResult } from "@/app/roadmap/actions";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_VMG_WHATSAPP_NUMBER || "";
const PHONE_NUMBER = process.env.NEXT_PUBLIC_VMG_PHONE || "";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full justify-center px-6 py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        "Aapka roadmap ban raha hai…"
      ) : (
        <>
          <Sparkles className="mr-2 inline h-4.5 w-4.5" />
          Mera Free Roadmap Banayein
        </>
      )}
    </button>
  );
}

function Field({ label, name, placeholder, textarea = false }: { label: string; name: string; placeholder?: string; textarea?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
        />
      ) : (
        <input
          id={name}
          name={name}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
        />
      )}
    </div>
  );
}

function RoadmapForm({ state }: { state: RoadmapActionResult }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="businessName" className="mb-1.5 block text-sm font-medium text-white/80">
            Business ka naam *
          </label>
          <input
            id="businessName"
            name="businessName"
            required
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
        </div>
        <div>
          <label htmlFor="contactName" className="mb-1.5 block text-sm font-medium text-white/80">
            Aapka naam *
          </label>
          <input
            id="contactName"
            name="contactName"
            required
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
        </div>
        <div>
          <label htmlFor="contactPhone" className="mb-1.5 block text-sm font-medium text-white/80">
            Phone / WhatsApp number *
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            required
            placeholder="10-digit ya country code ke saath"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
        </div>
        <Field label="Email (optional)" name="contactEmail" />
        <Field label="Industry / business type" name="industry" placeholder="Salon, restaurant, clinic…" />
        <Field label="City" name="city" />
        <Field label="Abhi website hai?" name="currentWebsite" placeholder="Link, ya 'nahi hai'" />
        <Field label="Abhi social media kaisa chal raha hai?" name="currentSocial" placeholder="Instagram/Facebook, kitna active" />
        <Field label="Abhi reviews/rating kaisi hai?" name="currentReviews" placeholder="Jaise '4.2 stars, 20 reviews' ya 'koi nahi'" />
        <Field label="Abhi marketing kaun karta hai?" name="currentMarketing" placeholder="Koi nahi / khud / purani agency" />
        <Field label="Sabse zyada kya chahiye?" name="primaryGoal" placeholder="Zyada calls, walk-ins, online sales…" />
        <Field label="Kitne time mein result chahiye?" name="timeline" placeholder="3 mahine, 6 mahine…" />
        <Field label="Budget range" name="budgetRange" placeholder="Rough idea kaafi hai" />
        <Field label="Aapke customers kaun hain?" name="targetAudience" placeholder="Umar, area, kya dhoondte hain" />
        <div className="sm:col-span-2">
          <Field label="Competitors ke naam (2-3)" name="competitors" />
        </div>
        <Field label="Brand ka tone kaisa chahiye?" name="brandTone" placeholder="Mazedaar, professional, premium…" />
        <Field label="Kya bechte hain (products/offers)" name="productsOffers" />
      </div>

      {/* Honeypot — real visitors never see this */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company_website">Website</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-6">
        <SubmitButton />
        {state.error && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {state.error}
          </p>
        )}
        <p className="mt-3 text-center text-xs text-white/40">
          Bilkul free hai, koi payment/card nahi chahiye. Aapki details sirf follow-up ke liye rakhi jaayengi.
        </p>
      </div>
    </div>
  );
}

function RoadmapResult({ lead }: { lead: NonNullable<RoadmapActionResult["lead"]> }) {
  const totalSteps = lead.roadmap_phases.length + 1;
  const doneSteps = 1;
  const remaining = totalSteps - doneSteps;

  const message = `Hi! Maine abhi ${lead.business_name} ke liye free roadmap generate kiya — baat karna chahta hoon.`;
  const waHref = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}` : null;
  const telHref = PHONE_NUMBER ? `tel:${PHONE_NUMBER}` : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold sm:text-3xl" style={{ textWrap: "balance" }}>
          {lead.business_name} ka Growth Roadmap 🚀
        </h2>
      </div>

      {lead.roadmap_current_state.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300">Abhi aap yahan hain</h3>
          <ul className="space-y-2">
            {lead.roadmap_current_state.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress / remaining steps */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-white">Aapka roadmap ban gaya</span>
          <span className="font-mono text-cyan-300">{doneSteps}/{totalSteps} steps</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-brand-400" style={{ width: `${(doneSteps / totalSteps) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm text-white/60">
          Sirf {remaining} steps baaki hain apne business ko agle level par le jaane ke liye — neeche dekhiye.
        </p>
      </div>

      <div className="space-y-3">
        {lead.roadmap_phases.map((phase, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 font-mono text-sm font-semibold text-cyan-300">
              {i + 2}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-white">{phase.title}</h4>
                <span className="font-mono text-xs text-white/40">{phase.timeframe}</span>
              </div>
              <ul className="space-y-1">
                {phase.points.map((point, j) => (
                  <li key={j} className="text-sm text-white/60">
                    — {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {lead.roadmap_vision && (
        <div className="rounded-2xl border border-brand-400/20 bg-gradient-to-br from-brand-500/10 to-cyan-400/5 p-6 text-center">
          <p className="text-lg leading-relaxed text-white" style={{ textWrap: "balance" }}>
            {lead.roadmap_vision}
          </p>
        </div>
      )}

      {lead.roadmap_urgency_line && <p className="text-center text-sm font-medium text-amber-300">{lead.roadmap_urgency_line}</p>}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Yeh roadmap shuru karne ke liye bas ek call/message door hai
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {waHref ? (
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-primary justify-center px-6 py-3 text-base">
              <MessageCircle className="mr-2 inline h-4.5 w-4.5" />
              WhatsApp par baat karein
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Jald hi active hoga"
              className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-white/10 px-6 py-3 text-base font-semibold text-white/40"
            >
              <MessageCircle className="mr-2 inline h-4.5 w-4.5" />
              WhatsApp (jald hi)
            </button>
          )}
          {telHref && (
            <a
              href={telHref}
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              <Phone className="mr-2 inline h-4.5 w-4.5" />
              Abhi Call Karein
            </a>
          )}
          {!waHref && !telHref && (
            <a href="mailto:hello@visionarymastersglobal.com" className="btn-primary justify-center px-6 py-3 text-base">
              Contact us
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function RoadmapLeadForm() {
  const [state, formAction] = useFormState<RoadmapActionResult, FormData>(generateRoadmapLeadAction, {});

  if (state.lead) {
    return <RoadmapResult lead={state.lead} />;
  }

  return (
    <form action={formAction}>
      <RoadmapForm state={state} />
    </form>
  );
}
