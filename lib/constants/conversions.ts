import type { ConversionEventType, ConversionLinkType } from "@/types/database";

export const CONVERSION_LINK_TYPE_LABELS: Record<ConversionLinkType, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone Call",
  form: "Form",
  booking: "Booking",
  other: "Other",
};

export const CONVERSION_EVENT_TYPE_LABELS: Record<ConversionEventType, string> = {
  click: "Click",
  lead: "Lead",
  sale: "Sale",
  booking: "Booking",
};
