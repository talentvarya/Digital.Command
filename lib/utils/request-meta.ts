import { headers } from "next/headers";

export function getRequestMeta() {
  const h = headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent");
  return { ipAddress, userAgent };
}
