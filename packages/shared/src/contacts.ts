import { z } from "zod";
import { CONTACT_AUDIENCES, CRM_SOURCES, CRM_STAGES } from "./enums";

const emptyToNull = (v: string | null | undefined) => {
  if (v == null) return v;
  const t = v.trim();
  return t ? t : null;
};

const emailField = z
  .union([z.string().trim().email("Correo no válido").max(180), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => emptyToNull(v ?? null));

const dateField = z
  .union([z.string().trim().min(8).max(40), z.literal("")])
  .optional()
  .nullable()
  .transform((v) => emptyToNull(v ?? null));

const moneyField = z.preprocess((v) => {
  if (v === "" || v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}, z.number().min(0).max(1_000_000).nullable().optional());

export const contactSchema = z.object({
  name: z.string().trim().max(180).optional().nullable(),
  phone: z.string().trim().min(6).max(40),
  email: emailField,
  audience: z.enum(CONTACT_AUDIENCES).optional().default("CONTACT"),
  stage: z.enum(CRM_STAGES).optional().default("NEW"),
  source: z.enum(CRM_SOURCES).optional().default("MANUAL"),
  notes: z.string().max(4000).optional().nullable(),
  expectedValue: moneyField,
  nextActionAt: dateField,
  nextAction: z.string().trim().max(240).optional().nullable(),
  lostReason: z.string().trim().max(240).optional().nullable(),
});

export const contactUpdateSchema = z
  .object({
    name: z.string().trim().max(180).optional().nullable(),
    email: emailField,
    audience: z.enum(CONTACT_AUDIENCES).optional(),
    stage: z.enum(CRM_STAGES).optional(),
    source: z.enum(CRM_SOURCES).optional(),
    notes: z.string().max(4000).optional().nullable(),
    expectedValue: moneyField,
    nextActionAt: dateField,
    nextAction: z.string().trim().max(240).optional().nullable(),
    lostReason: z.string().trim().max(240).optional().nullable(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.email !== undefined ||
      v.audience !== undefined ||
      v.stage !== undefined ||
      v.source !== undefined ||
      v.notes !== undefined ||
      v.expectedValue !== undefined ||
      v.nextActionAt !== undefined ||
      v.nextAction !== undefined ||
      v.lostReason !== undefined,
    { message: "Indica al menos un campo" },
  );

export const contactNoteSchema = z.object({
  body: z.string().trim().min(1, "Escribe una nota").max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactNoteInput = z.infer<typeof contactNoteSchema>;
