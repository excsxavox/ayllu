import { z } from "zod";
import { CHANNEL_TYPES, REPLY_MODES } from "./enums";

export const CHANNEL_LABELS: Record<(typeof CHANNEL_TYPES)[number], string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  MESSENGER: "Messenger",
  WEB: "Chat web",
  TELEGRAM: "Telegram",
};

export const botFlowSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional().nullable(),
  isDefault: z.boolean().optional(),
  systemPrompt: z.string().max(4000).optional().nullable(),
  tone: z.string().max(80).optional().nullable(),
  replyMode: z.enum(REPLY_MODES).optional(),
  channelIds: z.array(z.string().min(1)).optional(),
  ruleIds: z.array(z.string().min(1)).optional(),
});

export const channelSchema = z.object({
  type: z.enum(CHANNEL_TYPES),
  name: z.string().min(1).max(80),
  handle: z.string().max(80).optional().nullable(),
  isActive: z.boolean().optional(),
  flowId: z.string().min(1).optional().nullable(),
});

export const channelPatchSchema = channelSchema.partial();

export const channelInboundSchema = z.object({
  from: z.string().min(2).max(80),
  text: z.string().min(1).max(2000),
  contactName: z.string().max(120).optional(),
});

export type BotFlowInput = z.infer<typeof botFlowSchema>;
export type ChannelInput = z.infer<typeof channelSchema>;
export type ChannelPatchInput = z.infer<typeof channelPatchSchema>;
export type ChannelInboundInput = z.infer<typeof channelInboundSchema>;
