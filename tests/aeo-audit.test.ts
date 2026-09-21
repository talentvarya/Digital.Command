import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/web/fetch-page", () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from "@/lib/web/fetch-page";
import { runAeoAudit } from "@/lib/aeo/audit";

const mockedFetch = vi.mocked(fetchWithTimeout);

function respondWith(html: string, status = 200) {
  mockedFetch.mockResolvedValue(new Response(html, { status }));
}

function statusOf(findings: { area: string; status: string }[], area: string) {
  return findings.find((f) => f.area === area)?.status;
}

const GOOD_PAGE = `<html><head><title>Aura Lux Chocolate Co. — luxury chocolates in Pune</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Aura Lux"}</script>
</head><body>
<h2>What do you offer?</h2><h2>Where are you located?</h2><h2>How do I order?</h2>
<p>Call +91 98765 43210 — Shop 12, FC Road, near the main market.</p>
<p>Read what our customers say — 4.9 star rating from 300 reviews.</p>
</body></html>`;

// Braces matter: vitest treats a function RETURNED from beforeEach as a
// teardown callback and calls it after each test — returning the mock itself
// made it invoke fetchWithTimeout again (and throw) as "cleanup".
beforeEach(() => {
  mockedFetch.mockReset();
});

describe("runAeoAudit", () => {
  it("scores a well-structured local business page high, with every signal good", async () => {
    respondWith(GOOD_PAGE);
    const { score, findings } = await runAeoAudit("https://example.com");
    expect(score).toBe(100);
    for (const area of ["structured_data", "faq_content", "nap_text", "trust_signals", "page_title"]) {
      expect(statusOf(findings, area)).toBe("good");
    }
  });

  it("scores a bare page low and flags each missing signal", async () => {
    respondWith("<html><head></head><body><p>Welcome.</p></body></html>");
    const { score, findings } = await runAeoAudit("https://example.com");
    expect(score).toBeLessThan(50);
    expect(statusOf(findings, "structured_data")).toBe("missing");
    expect(statusOf(findings, "faq_content")).toBe("missing");
    expect(statusOf(findings, "nap_text")).toBe("missing");
  });

  it("recognises PLURAL review/testimonial/rating wording as a trust signal", async () => {
    for (const phrase of ["Read our reviews", "Customer testimonials", "Our ratings speak for themselves"]) {
      respondWith(`<html><head><title>A decent page title</title></head><body><p>${phrase}</p></body></html>`);
      const { findings } = await runAeoAudit("https://example.com");
      expect(statusOf(findings, "trust_signals"), phrase).toBe("good");
    }
  });

  it("notices JSON-LD that is not a LocalBusiness/Organization type", async () => {
    respondWith(
      `<html><head><title>A decent page title</title><script type="application/ld+json">{"@type":"WebSite"}</script></head><body></body></html>`
    );
    const { findings } = await runAeoAudit("https://example.com");
    expect(statusOf(findings, "structured_data")).toBe("needs_work");
  });

  it("reports an unreachable homepage instead of throwing", async () => {
    mockedFetch.mockRejectedValue(new Error("timeout"));
    const { score, findings } = await runAeoAudit("https://example.com");
    expect(statusOf(findings, "homepage")).toBe("missing");
    expect(score).toBe(60);
  });

  it("reports a non-200 homepage", async () => {
    respondWith("nope", 503);
    const { findings } = await runAeoAudit("https://example.com");
    expect(findings[0].message).toContain("503");
  });
});
