import { z } from "zod";
import { MEMBERSHIP_ROLES, REPLY_MODES } from "./enums";

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  companyName: z.string().min(2).max(160).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const createCompanySchema = z.object({
  name: z.string().min(2).max(160),
  timezone: z.string().min(1).max(80).default("America/Lima"),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(160).optional(),
  timezone: z.string().min(1).max(80).optional(),
  botSystemPrompt: z.string().max(4000).optional().nullable(),
  botTone: z.string().max(80).optional().nullable(),
  replyMode: z.enum(REPLY_MODES).optional(),
  setupCompleted: z.boolean().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(72).optional(),
  role: z.enum(MEMBERSHIP_ROLES),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(MEMBERSHIP_ROLES),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
