import { StatusBadge } from "@/components/StatusBadge";
import { mapConnectionStatus } from "@/lib/constants/health";
import { LINK_TYPE_LABELS } from "@/lib/constants/content";
import { GOOGLE_SERVICE_LABELS } from "@/lib/constants/google";
import type { GoogleService, OrgLink } from "@/types/database";

// Shared between the client's own view (/app/health) and the admin's
// read-only per-client view (/admin/clients/[orgId]) — pure presentation,
// no auth/role logic of its own, so it lives at the top level rather than
// under components/admin/ or components/client/.
export function HealthCenterPanel({
  links,
  googleConnections,
  bufferLinked,
}: {
  links: OrgLink[];
  googleConnections: { service: string; status: string }[];
  bufferLinked: boolean;
}) {
  const googleStatusByService = new Map(googleConnections.map((c) => [c.service, c.status]));

  const rows: { label: string; status: string }[] = [
    ...links.map((l) => ({ label: LINK_TYPE_LABELS[l.link_type], status: mapConnectionStatus(l.status) })),
    ...(Object.keys(GOOGLE_SERVICE_LABELS) as GoogleService[]).map((service) => ({
      label: GOOGLE_SERVICE_LABELS[service],
      status: mapConnectionStatus(googleStatusByService.get(service)),
    })),
    { label: "Buffer", status: bufferLinked ? "healthy" : "not_added" },
    { label: "Email service", status: "not_added" },
  ];

  return (
    <div className="space-y-1 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between border-b border-ink-50 py-1.5 last:border-0">
          <span className="text-ink-700">{r.label}</span>
          <StatusBadge status={r.status} />
        </div>
      ))}
    </div>
  );
}
