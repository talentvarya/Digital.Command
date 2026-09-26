// Cloudflare Workers AI — FLUX.1 schnell text-to-image, the free source of "AI
// photos" in Creative Studio. The free plan includes 10,000 "neurons" a day
// (roughly 170+ images) and simply stops when they run out — it never bills —
// and the allowance resets at 00:00 UTC (5:30 AM IST). App-wide credentials, not
// per-client: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN.

export class CloudflareImageError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "quota" | "failed" = "failed"
  ) {
    super(message);
  }
}

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

export function cloudflareImageConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_AI_API_TOKEN?.trim());
}

interface RunResponse {
  success?: boolean;
  result?: { image?: string };
  errors?: { code?: number; message?: string }[];
}

// Returns the generated image's bytes (a JPEG or PNG).
export async function generateFluxImage(prompt: string, opts: { steps?: number; timeoutMs?: number } = {}): Promise<Uint8Array> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
  if (!accountId || !token) {
    throw new CloudflareImageError(
      "AI photos aren't set up yet — CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN are missing.",
      "not_configured"
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);
  let res: Response;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: opts.steps ?? 4 }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    throw new CloudflareImageError(
      timedOut ? "The AI photo took too long — try again." : `Could not reach the AI photo service: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => null)) as RunResponse | null;
  const image = body?.result?.image;
  if (!res.ok || !body?.success || !image) {
    const message = (body?.errors ?? []).map((e) => e.message).filter(Boolean).join("; ");
    const quota =
      res.status === 429 || (body?.errors ?? []).some((e) => e.code === 4006) || /free allocation|neurons|rate limit/i.test(message);
    if (quota) {
      throw new CloudflareImageError(
        "The free AI photo allowance for today is used up — it resets at 5:30 AM IST. (Upgrading the Cloudflare plan lifts the limit.)",
        "quota"
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new CloudflareImageError("The AI photo service rejected the credentials — check CLOUDFLARE_AI_API_TOKEN.");
    }
    throw new CloudflareImageError(`AI photo generation failed (${res.status})${message ? `: ${message}` : ""}`);
  }

  return Uint8Array.from(Buffer.from(image, "base64"));
}
