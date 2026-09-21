"use client";

import { useState } from "react";
import { Braces, Copy, Check } from "lucide-react";

function CopyBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard can be unavailable — the code is still selectable on screen
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <button type="button" onClick={copy} className="btn-secondary px-3 py-1.5 text-xs">
          {copied ? <Check className="mr-1 inline h-3 w-3" /> : <Copy className="mr-1 inline h-3 w-3" />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink-50 p-3 font-mono text-xs text-ink-700">{code}</pre>
    </div>
  );
}

export function SchemaMarkupCard({
  businessCode,
  faqCode,
  missing,
}: {
  businessCode: string;
  faqCode: string | null;
  missing: string[];
}) {
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <Braces className="h-4 w-4 text-ink-400" /> Structured data (schema markup)
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Ready-to-paste code built only from what you&apos;ve already entered — nothing is guessed. Add it inside the{" "}
          <code className="rounded bg-ink-50 px-1 text-xs">&lt;head&gt;</code> of your website (or hand it to your web
          developer). It makes your business facts unambiguous for search and AI engines to read; it doesn&apos;t
          guarantee a ranking or an AI mention.
        </p>
      </div>

      <CopyBlock title="Business details" code={businessCode} />

      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Not included yet because it isn&apos;t filled in: {missing.join(", ")}. Add it in Brand Brain, Local SEO or
          your website links and this code gets fuller.
        </p>
      )}

      {faqCode ? (
        <CopyBlock title="FAQ" code={faqCode} />
      ) : (
        <p className="text-xs text-ink-400">Draft FAQ content above and its FAQ markup will appear here too.</p>
      )}
    </div>
  );
}
