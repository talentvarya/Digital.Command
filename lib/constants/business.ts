import type { BusinessType } from "@/types/database";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  individual: "Individual",
  proprietorship: "Proprietorship",
  partnership: "Partnership Firm",
  private_limited: "Private Limited Company",
  public_limited: "Public Limited / Limited Company",
};

export interface DocRequirement {
  key: string;
  label: string;
  required: boolean;
}

export interface DetailField {
  key: string;
  label: string;
  required: boolean;
}

// Spec section 4.2 — required identity/business verification documents and
// detail fields per business type. Documents are files uploaded to the
// verification-documents bucket; detail fields are stored in
// business_verifications.details (jsonb).
export const BUSINESS_TYPE_REQUIREMENTS: Record<
  BusinessType,
  { documents: DocRequirement[]; details: DetailField[] }
> = {
  individual: {
    documents: [
      { key: "pan", label: "PAN Card", required: true },
      { key: "identity_proof", label: "Identity Proof (Aadhaar-compliant or permitted alternative)", required: true },
    ],
    details: [],
  },
  proprietorship: {
    documents: [
      { key: "proprietor_pan", label: "Proprietor PAN", required: true },
      { key: "identity_proof", label: "Proprietor Identity Proof", required: true },
      { key: "gstin_certificate", label: "GSTIN Certificate (if applicable)", required: false },
      { key: "udyam_certificate", label: "Udyam Registration (optional)", required: false },
    ],
    details: [{ key: "trade_name", label: "Trade / Business Name (optional)", required: false }],
  },
  partnership: {
    documents: [
      { key: "firm_pan", label: "Firm PAN", required: true },
      { key: "partner_identity_proof", label: "Authorized Partner/Signatory Identity Proof", required: true },
      { key: "partnership_deed", label: "Partnership Deed", required: true },
      { key: "gstin_certificate", label: "GSTIN Certificate (if applicable)", required: false },
    ],
    details: [],
  },
  private_limited: {
    documents: [
      { key: "certificate_of_incorporation", label: "Certificate of Incorporation", required: true },
      { key: "company_pan", label: "Company PAN", required: true },
      { key: "director_identity_proof", label: "Authorized Director/Signatory Identity Proof", required: true },
      { key: "gstin_certificate", label: "GSTIN Certificate (if applicable)", required: false },
      { key: "authorization_letter", label: "Authorization Proof (if needed)", required: false },
    ],
    details: [
      { key: "cin", label: "Corporate Identification Number (CIN)", required: true },
      { key: "registered_office", label: "Registered Office Address", required: true },
    ],
  },
  public_limited: {
    documents: [
      { key: "incorporation_certificate", label: "Incorporation / Registration Documents", required: true },
      { key: "company_pan", label: "Company PAN", required: true },
      { key: "director_identity_proof", label: "Authorized Director/Signatory Identity Proof", required: true },
      { key: "gstin_certificate", label: "GSTIN Certificate (if applicable)", required: false },
    ],
    details: [
      { key: "company_identifier", label: "Company Registration / Identification Number", required: true },
      { key: "registered_office", label: "Registered Office Address", required: true },
    ],
  },
};
