"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { deleteConversionLinkAction } from "@/app/app/conversions/actions";
import { CONVERSION_LINK_TYPE_LABELS } from "@/lib/constants/conversions";
import type { ConversionLink } from "@/types/database";

export function ConversionLinkRow({ link }: { link: ConversionLink }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const trackingUrl = `${origin}/api/track/${link.id}`;

  return (
    <div className="card flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase text-ink-400">{CONVERSION_LINK_TYPE_LABELS[link.type]}</span>
          <span className="font-medium text-ink-800">{link.label}</span>
        </div>
        <p className="text-xs text-ink-400">{link.destination}</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="rounded bg-ink-50 px-2 py-1 text-xs text-ink-600">{trackingUrl || "…"}</code>
        <button
          className="text-ink-400 hover:text-brand-600"
          aria-label="Copy tracking link"
          onClick={() => {
            navigator.clipboard.writeText(trackingUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
        <ActionForm action={deleteConversionLinkAction}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={link.id} />
              <button type="submit" aria-label="Delete link" className="text-ink-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
              <FormError message={state.error} />
            </>
          )}
        </ActionForm>
      </div>
    </div>
  );
}
