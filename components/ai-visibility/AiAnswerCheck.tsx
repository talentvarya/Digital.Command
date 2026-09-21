"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, MessageSquareQuote } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { runAiVisibilityCheckAction } from "@/app/app/ai-visibility/actions";
import type { AiVisibilityCheck } from "@/types/database";

export type AiCheckMode = "locked" | "connect" | "ready";

function Chip({ tone, children }: { tone: "good" | "warn" | "info" | "muted"; children: React.ReactNode }) {
  const styles = {
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    info: "bg-brand-100 text-brand-700",
    muted: "bg-ink-100 text-ink-600",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>;
}

export function AiAnswerCheck({
  mode,
  suggestedQuery,
  checks,
  costPerQuery,
  maxQueries,
}: {
  mode: AiCheckMode;
  suggestedQuery: string | null;
  checks: AiVisibilityCheck[];
  costPerQuery: number;
  maxQueries: number;
}) {
  const [text, setText] = useState(suggestedQuery ?? "");
  const count = text.split("\n").filter((l) => l.trim()).length;

  const answered = checks.filter((c) => c.answered);
  const named = answered.filter((c) => c.brand_mentioned).length;

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <MessageSquareQuote className="h-4 w-4 text-ink-400" /> What Google&apos;s AI actually says
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Ask Google&apos;s AI Mode the questions your customers ask, and see whether it names your business, cites
          your website, or recommends competitors instead. AI answers change from run to run, so read this as a
          sample, not a ranking.
        </p>
      </div>

      {mode === "locked" && (
        <div className="flex items-start gap-3 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            This is a premium add-on that runs on your own Apify account. Ask your Digital Command contact to enable it.
          </span>
        </div>
      )}

      {mode === "connect" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Connect your Apify account first on the{" "}
          <Link href="/app/competitor-search" className="font-medium underline">
            Competitor Search
          </Link>{" "}
          page — this check runs on it.
        </p>
      )}

      {mode === "ready" && (
        <ActionForm action={runAiVisibilityCheckAction} className="space-y-2">
          {(state) => (
            <>
              <label className="field-label" htmlFor="ai-queries">
                Customer questions (one per line, up to {maxQueries})
              </label>
              <textarea
                id="ai-queries"
                name="queries"
                rows={3}
                className="field-input"
                placeholder="best chocolate shop in Pune"
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
              <p className="text-xs text-ink-500">
                About ${(Math.max(count, 1) * costPerQuery).toFixed(2)} in Apify credits for {Math.max(count, 1)} question
                {Math.max(count, 1) > 1 ? "s" : ""} at Apify&apos;s free-tier prices (less on a paid Apify plan). It runs
                only when you press the button.
              </p>
              <SubmitButton className="btn-primary px-4 py-2 text-sm" pendingLabel="Asking Google's AI…">
                Check what AI says
              </SubmitButton>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      )}

      {checks.length > 0 && (
        <div className="space-y-3 border-t border-ink-50 pt-4">
          <p className="text-sm text-ink-700">
            Named in <strong>{named}</strong> of <strong>{answered.length}</strong> AI answers received (last{" "}
            {checks.length} checks).
          </p>
          {checks.map((c) => (
            <div key={c.id} className="rounded-lg border border-ink-100 p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">&quot;{c.query}&quot;</span>
                <span className="text-xs text-ink-400">{new Date(c.run_at).toLocaleString()}</span>
              </div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                {!c.answered && <Chip tone="muted">No AI answer returned</Chip>}
                {c.answered && (c.brand_mentioned ? <Chip tone="good">Your business is named</Chip> : <Chip tone="warn">Not named</Chip>)}
                {c.brand_cited && <Chip tone="info">Your website is cited</Chip>}
                {c.competitors_mentioned.length > 0 && <Chip tone="muted">Also named: {c.competitors_mentioned.join(", ")}</Chip>}
              </div>
              {c.excerpt && <p className="text-xs leading-relaxed text-ink-500">{c.excerpt}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
