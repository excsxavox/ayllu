export const PLATFORM_ROLES = ["USER", "PLATFORM_ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const MEMBERSHIP_ROLES = ["COMPANY_ADMIN", "AGENT"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const WHATSAPP_PROVIDERS = ["META", "EVOLUTION", "TWILIO"] as const;
export type WhatsAppProvider = (typeof WHATSAPP_PROVIDERS)[number];

export const DISCOUNT_TYPES = ["PERCENT", "FIXED", "BOGO"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const RULE_TYPES = [
  "HOURS",
  "GREETING",
  "HANDOVER",
  "KEYWORD",
  "PROMOTION",
  "FALLBACK",
  "TAG_CONTACT",
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const CONVERSATION_STATUSES = ["BOT", "HUMAN", "CLOSED"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const KNOWLEDGE_SOURCES = ["FAQ", "MANUAL", "CATALOG"] as const;
export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number];

export const REPLY_MODES = ["AUTO", "HYBRID", "MANUAL"] as const;
export type ReplyMode = (typeof REPLY_MODES)[number];

export const ALERT_TYPES = [
  "NEW_CONVERSATION",
  "HUMAN_TAKEOVER",
  "BOT_FALLBACK",
  "OUTSIDE_HOURS",
  "NEEDS_REPLY",
  "PAYMENT_PROOF",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const BOOKING_MODES = ["SERVICES", "PRODUCTS", "BOTH"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = ["PANEL", "BOT", "MANUAL"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const BOOKING_PAYMENT_STATUSES = ["PENDING", "DEPOSIT", "PAID"] as const;
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

export const BOOKING_FIELD_TYPES = ["text", "textarea", "phone", "email", "number", "select"] as const;
export type BookingFieldType = (typeof BOOKING_FIELD_TYPES)[number];

export const CHANNEL_TYPES = ["WHATSAPP", "INSTAGRAM", "MESSENGER", "WEB", "TELEGRAM"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CONTACT_AUDIENCES = ["CLIENT", "CONTACT"] as const;
export type ContactAudience = (typeof CONTACT_AUDIENCES)[number];

export const CRM_STAGES = ["NEW", "TALKING", "INTERESTED", "RESERVED", "WON", "LOST"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_SOURCES = ["WHATSAPP", "MANUAL", "WALKIN", "OTHER"] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];

export const CRM_ACTIVITY_TYPES = ["NOTE", "STAGE", "FOLLOW"] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export const PAYMENT_METHOD_TYPES = ["TRANSFER", "CARD"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];
