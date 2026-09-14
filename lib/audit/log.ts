import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestMeta } from "@/lib/utils/request-meta";
import type { AuditSource } from "@/types/database";

interface LogAuditParams {
  orgId?: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  source: AuditSource;
  actionType: string;
  target?: string | null;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  result?: "success" | "failure";
  failureReason?: string | null;
}

// Called from every mutating server action so the audit trail (spec section
// 19) always reflects who/what/when/before/after. audit_logs has no
// update/delete RLS policy, so once written a row cannot be altered.
export async function logAudit(supabase: SupabaseClient, params: LogAuditParams) {
  const { ipAddress, userAgent } = getRequestMeta();

  const { error } = await supabase.from("audit_logs").insert({
    org_id: params.orgId ?? null,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    source: params.source,
    action_type: params.actionType,
    target: params.target ?? null,
    previous_state: params.previousState ?? null,
    new_state: params.newState ?? null,
    result: params.result ?? "success",
    failure_reason: params.failureReason ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    console.error("audit log insert failed", error);
  }
}
