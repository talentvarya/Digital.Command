"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MessageCircle, Phone, Sparkles, CheckCircle2, Radar } from "lucide-react";
import { generateRoadmapLeadAction, type RoadmapActionResult } from "@/app/roadmap/actions";
import { ROADMAP_COPY, type RoadmapLanguage } from "@/lib/i18n/roadmap";
import { RoadmapJourneyDiagram } from "@/components/roadmap/RoadmapJourneyDiagram";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_VMG_WHATSAPP_NUMBER || "";
const PHONE_NUMBER = process.env.NEXT_PUBLIC_VMG_PHONE || "";

function LanguageToggle({ language, onChange }: { language: RoadmapLanguage; onChange: (l: RoadmapLanguage) => void }) {
  return (
    <div className="mx-auto mb-6 flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      {(["en", "hi"] as RoadmapLanguage[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            language === l ? "bg-brand-600 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          {l === "en" ? "English" : "Hinglish"}
        </button>
      ))}
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full justify-center px-6 py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        pendingLabel
      ) : (
        <>
          <Sparkles className="mr-2 inline h-4.5 w-4.5" />
          {label}
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

function RoadmapForm({ state, language }: { state: RoadmapActionResult; language: RoadmapLanguage }) {
  const t = ROADMAP_COPY[language];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
      <input type="hidden" name="language" value={language} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="businessName" className="mb-1.5 block text-sm font-medium text-white/80">
            {t.fields.businessName}
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
            {t.fields.contactName}
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
            {t.fields.contactPhone}
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            required
            placeholder={t.fields.contactPhonePlaceholder}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
        </div>
        <Field label={t.fields.contactEmail} name="contactEmail" />
        <Field label={t.fields.industry} name="industry" placeholder={t.fields.industryPlaceholder} />
        <Field label={t.fields.city} name="city" />
        <Field label={t.fields.currentWebsite} name="currentWebsite" placeholder={t.fields.currentWebsitePlaceholder} />
        <Field label={t.fields.currentSocial} name="currentSocial" placeholder={t.fields.currentSocialPlaceholder} />
        <Field label={t.fields.currentReviews} name="currentReviews" placeholder={t.fields.currentReviewsPlaceholder} />
        <Field label={t.fields.currentMarketing} name="currentMarketing" placeholder={t.fields.currentMarketingPlaceholder} />
        <Field label={t.fields.primaryGoal} name="primaryGoal" placeholder={t.fields.primaryGoalPlaceholder} />
        <Field label={t.fields.timeline} name="timeline" placeholder={t.fields.timelinePlaceholder} />
        <Field label={t.fields.budgetRange} name="budgetRange" placeholder={t.fields.budgetRangePlaceholder} />
        <Field label={t.fields.targetAudience} name="targetAudience" placeholder={t.fields.targetAudiencePlaceholder} />
        <div className="sm:col-span-2">
          <Field label={t.fields.competitors} name="competitors" />
        </div>
        <Field label={t.fields.brandTone} name="brandTone" placeholder={t.fields.brandTonePlaceholder} />
        <Field label={t.fields.productsOffers} name="productsOffers" />
      </div>

      {/* Honeypot — real visitors never see this */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company_website">Website</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-6">
        <SubmitButton label={t.submitIdle} pendingLabel={t.submitPending} />
        {state.error && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {state.error}
          </p>
        )}
        <p className="mt-3 text-center text-xs text-white/40">{t.disclaimer}</p>
      </div>
    </div>
  );
}

function RoadmapResult({ lead, language }: { lead: NonNullable<RoadmapActionResult["lead"]>; language: RoadmapLanguage }) {
  const t = ROADMAP_COPY[language];
  const totalSteps = lead.roadmap_phases.length + 1;
  const doneSteps = 1;
  const remaining = totalSteps - doneSteps;

  const message = `Hi! ${language === "hi" ? `Maine abhi ${lead.business_name} ke liye free roadmap generate kiya — baat karna chahta hoon.` : `I just generated a free roadmap for ${lead.business_name} — I'd like to talk.`}`;
  const waHref = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}` : null;
  const telHref = PHONE_NUMBER ? `tel:${PHONE_NUMBER}` : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold sm:text-3xl" style={{ textWrap: "balance" }}>
          {lead.business_name}
          {t.resultHeadingSuffix}
        </h2>
      </div>

      {lead.roadmap_current_state.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300">{t.currentStateHeading}</h3>
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

      {/* Journey diagram — the same steps the cards below spell out in
          bullets, as one connected picture: done → each phase in order. */}
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-white">{t.progressHeading}</span>
          <span className="font-mono text-cyan-300">
            {doneSteps}/{totalSteps} {t.progressStepsLabel}
          </span>
        </div>
        <RoadmapJourneyDiagram phases={lead.roadmap_phases} readyLabel={t.roadmapReadyLabel} />
        <p className="mt-3 text-sm text-white/60">{t.progressSub(remaining)}</p>
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
          {t.ctaHeading}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {waHref ? (
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-primary justify-center px-6 py-3 text-base">
              <MessageCircle className="mr-2 inline h-4.5 w-4.5" />
              {t.whatsappCta}
            </a>
          ) : (
            <button
              type="button"
              disabled
              title={language === "hi" ? "Jald hi active hoga" : "Coming soon"}
              className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-white/10 px-6 py-3 text-base font-semibold text-white/40"
            >
              <MessageCircle className="mr-2 inline h-4.5 w-4.5" />
              {t.whatsappComingSoon}
            </button>
          )}
          {telHref && (
            <a
              href={telHref}
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              <Phone className="mr-2 inline h-4.5 w-4.5" />
              {t.callCta}
            </a>
          )}
          {!waHref && !telHref && (
            <a href="mailto:hello@visionarymastersglobal.com" className="btn-primary justify-center px-6 py-3 text-base">
              {t.contactUs}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function RoadmapLeadForm() {
  const [language, setLanguage] = useState<RoadmapLanguage>("en");
  const [state, formAction] = useFormState<RoadmapActionResult, FormData>(generateRoadmapLeadAction, {});
  const t = ROADMAP_COPY[language];

  return (
    <>
      <LanguageToggle language={language} onChange={setLanguage} />

      {!state.lead && (
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            <Radar className="h-3.5 w-3.5" />
            {t.heroEyebrow}
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ textWrap: "balance" }}>
            {t.heroHeading}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{t.heroSub}</p>
        </div>
      )}

      {state.lead ? (
        <RoadmapResult lead={state.lead} language={language} />
      ) : (
        <form action={formAction}>
          <RoadmapForm state={state} language={language} />
        </form>
      )}
    </>
  );
}
