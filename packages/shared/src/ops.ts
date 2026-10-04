import { z } from "zod";
import { ALERT_TYPES, PAYMENT_METHOD_TYPES, REPLY_MODES } from "./enums";

export const alertSettingsSchema = z.object({
  settings: z.array(
    z.object({
      type: z.enum(ALERT_TYPES),
      enabled: z.boolean(),
    }),
  ),
});

export const cannedReplySchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  shortcut: z.string().max(40).optional().nullable(),
  keywords: z.array(z.string().min(1)).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const replyModeSchema = z.object({
  replyMode: z.enum(REPLY_MODES),
});

export const paymentMethodSchema = z
  .object({
    type: z.enum(PAYMENT_METHOD_TYPES),
    name: z.string().min(1).max(80),
    isActive: z.boolean().optional().default(false),
    bank: z.string().max(80).optional().nullable(),
    accountType: z.string().max(40).optional().nullable(),
    accountNumber: z.string().max(40).optional().nullable(),
    accountHolder: z.string().max(120).optional().nullable(),
    holderId: z.string().max(40).optional().nullable(),
    receiptEmail: z.union([z.string().email().max(120), z.literal("")]).optional().nullable(),
    paymentUrl: z.union([z.string().url().max(500), z.literal("")]).optional().nullable(),
    notes: z.string().max(800).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TRANSFER" && !value.accountNumber?.trim()) {
      ctx.addIssue({ code: "custom", message: "Indica el número de cuenta", path: ["accountNumber"] });
    }
    if (value.type === "CARD" && !value.paymentUrl) {
      ctx.addIssue({ code: "custom", message: "Indica el link de pago con tarjeta", path: ["paymentUrl"] });
    }
  });

export type AlertSettingsInput = z.infer<typeof alertSettingsSchema>;
export type CannedReplyInput = z.infer<typeof cannedReplySchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
