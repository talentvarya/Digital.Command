"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { FormError } from "@/components/FormError";
import { createReviewRequestAction } from "@/app/app/reputation/actions";
import type { ReviewPlatform, ReviewRequestChannel } from "@/types/database";

function digitsOnly(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function SendReviewRequestForm({
  businessName,
  googleReviewLink,
  facebookReviewLink,
}: {
  businessName: string;
  googleReviewLink: string | null;
  facebookReviewLink: string | null;
}) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [channel, setChannel] = useState<ReviewRequestChannel>("whatsapp");
  const [reviewPlatform, setReviewPlatform] = useState<ReviewPlatform>(googleReviewLink ? "google" : "facebook");

  if (!googleReviewLink && !facebookReviewLink) {
    return (
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold text-ink-900">Send a review request</h2>
        <p className="text-sm text-ink-500">
          Add your Google or Facebook review link below first — that&apos;s what customers get sent to.
        </p>
      </div>
    );
  }

  const activeLink = reviewPlatform === "facebook" ? facebookReviewLink : googleReviewLink;
  const message = activeLink
    ? `Hi ${contactName || "there"}, thanks for choosing ${businessName}! If you have a minute, we'd really appreciate a quick review: ${activeLink}`
    : "";

  function openHref() {
    if (channel === "whatsapp") return contactPhone ? `https://wa.me/${digitsOnly(contactPhone)}?text=${encodeURIComponent(message)}` : null;
    if (channel === "sms") return contactPhone ? `sms:${contactPhone}?body=${encodeURIComponent(message)}` : null;
    return contactEmail ? `mailto:${contactEmail}?subject=${encodeURIComponent("A quick favor?")}&body=${encodeURIComponent(message)}` : null;
  }
  const href = openHref();

  return (
    <ActionForm action={createReviewRequestAction} className="card space-y-3">
      {(state) => (
        <>
          <h2 className="text-lg font-semibold text-ink-900">Send a review request</h2>
          <p className="text-sm text-ink-500">
            Digital Command builds the message — it&apos;s sent from your own WhatsApp/SMS/email, never automatically.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Customer name</label>
              <input
                className="field-input"
                name="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Which review link?</label>
              <select
                className="field-input"
                value={reviewPlatform}
                onChange={(e) => setReviewPlatform(e.target.value as ReviewPlatform)}
              >
                {googleReviewLink && <option value="google">Google</option>}
                {facebookReviewLink && <option value="facebook">Facebook</option>}
              </select>
            </div>

            <div>
              <label className="field-label">Send via</label>
              <select className="field-input" name="channel" value={channel} onChange={(e) => setChannel(e.target.value as ReviewRequestChannel)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
            {channel === "email" ? (
              <div>
                <label className="field-label">Customer email</label>
                <input
                  className="field-input"
                  name="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="field-label">Customer phone</label>
                <input
                  className="field-input"
                  name="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="10-digit or with country code"
                  required
                />
              </div>
            )}
          </div>

          <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">{message || "Message preview appears here…"}</div>

          <input type="hidden" name="messageSent" value={message} />

          <button
            type="submit"
            className={`btn-primary px-4 py-2 ${!href ? "cursor-not-allowed opacity-50" : ""}`}
            disabled={!href}
            onClick={() => {
              if (href) window.open(href, "_blank", "noopener,noreferrer");
            }}
          >
            {channel === "whatsapp" ? "Open WhatsApp & log request" : channel === "sms" ? "Open SMS & log request" : "Open Email & log request"}
          </button>
          <FormError message={state.error} />
        </>
      )}
    </ActionForm>
  );
}
