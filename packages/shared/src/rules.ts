import { z } from "zod";
import { RULE_TYPES } from "./enums";

export const ruleConditionsSchema = z
  .object({
    timezone: z.string().optional(),
    days: z.array(z.number().int().min(0).max(6)).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    keywords: z.array(z.string().min(1)).optional(),
    matchMode: z.enum(["any", "all"]).optional(),
    firstMessageOnly: z.boolean().optional(),
    outsideHours: z.boolean().optional(),
    promotionId: z.string().optional(),
    tagId: z.string().optional(),
    minGuests: z.number().int().min(1).max(500).optional(),
  })
  .passthrough();

export const ruleActionsSchema = z
  .object({
    reply: z.string().optional(),
    transferToHuman: z.boolean().optional(),
    suggestPromotion: z.boolean().optional(),
    tagContact: z.boolean().optional(),
    closeConversation: z.boolean().optional(),
  })
  .passthrough();

export const businessRuleSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(RULE_TYPES),
  priority: z.number().int().min(0).max(1000).default(100),
  enabled: z.boolean().optional().default(true),
  flowId: z.string().min(1).optional().nullable(),
  conditions: ruleConditionsSchema.default({}),
  actions: ruleActionsSchema.default({}),
});

export type BusinessRuleInput = z.infer<typeof businessRuleSchema>;
export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type RuleActions = z.infer<typeof ruleActionsSchema>;
