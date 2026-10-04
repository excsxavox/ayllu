import { z } from "zod";
import { WHATSAPP_PROVIDERS } from "./enums";

export const whatsappSettingsSchema = z.object({
  provider: z.enum(WHATSAPP_PROVIDERS).default("META"),
  phoneNumberId: z.string().min(1).max(80),
  wabaId: z.string().max(80).optional().nullable(),
  displayPhone: z.string().max(40).optional().nullable(),
  accessToken: z.string().min(1).optional(),
  verifyToken: z.string().min(1).optional(),
  appSecret: z.string().min(1).optional(),
  isActive: z.boolean().optional().default(true),
});

export const aiSettingsSchema = z.object({
  llmApiKey: z.string().min(1).optional().nullable(),
  llmBaseUrl: z.string().url().optional().nullable(),
  chatModel: z.string().max(80).optional().nullable(),
  embeddingModel: z.string().max(80).optional().nullable(),
  botSystemPrompt: z.string().max(4000).optional().nullable(),
  botTone: z.string().max(80).optional().nullable(),
  mapUrl: z.union([z.string().url().max(500), z.literal("")]).optional().nullable(),
});

export const sendInboxMessageSchema = z.object({
  text: z.string().min(1).max(4096),
});

export type WhatsAppSettingsInput = z.infer<typeof whatsappSettingsSchema>;
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;

export type NormalizedInboundMessage = {
  provider: (typeof WHATSAPP_PROVIDERS)[number];
  phoneNumberId: string;
  from: string;
  to?: string;
  contactName?: string;
  providerMessageId: string;
  type: string;
  text: string;
  timestamp: string;
  mediaId?: string;
  mimeType?: string;
  raw: unknown;
};
