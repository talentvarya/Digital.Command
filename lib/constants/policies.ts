import type { PolicyType } from "@/types/database";

// Every one of these must be accepted before registration can submit (spec
// section 5). Promotional/marketing-communication consent is intentionally
// NOT in this list — it's optional and stored separately (organizations.promo_opt_in).
export const REQUIRED_POLICY_TYPES: PolicyType[] = [
  "terms",
  "privacy",
  "package_scope",
  "verification_consent",
  "marketing_authorization",
  "data_retention",
  "refund_cancellation",
  "audit_logging_consent",
  "third_party_disclosure",
  "authorized_representative",
];
