import { z } from "zod";
import { DISCOUNT_TYPES } from "./enums";

export const categorySchema = z.object({
  name: z.string().min(1).max(120),
});

const httpLink = z
  .string()
  .trim()
  .min(1)
  .max(800)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/uploads/"), {
    message: "Usa un enlace http(s) o una imagen subida",
  });

export const productLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: httpLink,
});

export const productSchema = z.object({
  name: z.string().min(1).max(180),
  description: z.string().max(4000).optional().nullable(),
  sku: z.string().max(80).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isAddon: z.boolean().optional().default(false),
  stock: z.number().int().min(0).max(9999).optional().nullable(),
  parentServiceId: z.string().cuid().optional().nullable(),
  imageUrls: z.array(httpLink).max(12).optional().default([]),
  links: z.array(productLinkSchema).max(12).optional().default([]),
});

export const serviceSchema = z.object({
  name: z.string().min(1).max(180),
  description: z.string().max(4000).optional().nullable(),
  durationMinutes: z.number().int().min(0).max(24 * 60).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  imageUrls: z.array(httpLink).max(12).optional(),
});

export const priceSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().min(3).max(8).default("USD"),
  label: z.string().min(1).max(80).default("regular"),
  isDefault: z.boolean().optional().default(false),
  productId: z.string().cuid().optional().nullable(),
  serviceId: z.string().cuid().optional().nullable(),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional().nullable(),
});

export const attachTagsSchema = z.object({
  tagIds: z.array(z.string().cuid()),
});

export const promotionSchema = z.object({
  name: z.string().min(1).max(180),
  description: z.string().max(4000).optional().nullable(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.number().min(0),
  code: z.string().max(40).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  imageUrls: z.array(httpLink).max(12).optional().default([]),
  productIds: z.array(z.string().cuid()).optional(),
  serviceIds: z.array(z.string().cuid()).optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type PriceInput = z.infer<typeof priceSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type PromotionInput = z.infer<typeof promotionSchema>;
