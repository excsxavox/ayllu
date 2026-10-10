import { z } from "zod";
import { BOOKING_FIELD_TYPES, BOOKING_MODES, BOOKING_PAYMENT_STATUSES, BOOKING_STATUSES } from "./enums";

export const bookingHoursSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const bookingWeeklyHoursSchema = z.object({
  mon: z.array(bookingHoursSlotSchema).optional().default([]),
  tue: z.array(bookingHoursSlotSchema).optional().default([]),
  wed: z.array(bookingHoursSlotSchema).optional().default([]),
  thu: z.array(bookingHoursSlotSchema).optional().default([]),
  fri: z.array(bookingHoursSlotSchema).optional().default([]),
  sat: z.array(bookingHoursSlotSchema).optional().default([]),
  sun: z.array(bookingHoursSlotSchema).optional().default([]),
});

export const bookingCustomFieldSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(80),
  type: z.enum(BOOKING_FIELD_TYPES),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().min(1).max(80)).optional(),
});

export const bookingPlaceSchema = z.object({
  id: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(30).optional().default("map"),
  unitCount: z.number().int().min(1).max(40),
  x: z.number().min(4).max(96).optional().default(50),
  y: z.number().min(4).max(96).optional().default(50),
  trackGuests: z.boolean().optional(),
});

export type BookingPlace = z.infer<typeof bookingPlaceSchema>;

export const DEFAULT_BOOKING_PLACES: BookingPlace[] = [
  { id: "glamping", name: "Glamping", icon: "tent", unitCount: 4, x: 23.5, y: 15, trackGuests: true },
  { id: "acampar", name: "Acampar", icon: "tent", unitCount: 6, x: 40, y: 28, trackGuests: true },
  { id: "restaurante", name: "Restaurante", icon: "utensils", unitCount: 8, x: 15.5, y: 47 },
  { id: "pesca", name: "Pesca", icon: "spark", unitCount: 12, x: 86.5, y: 42 },
  { id: "botes", name: "Botes a remo", icon: "boat", unitCount: 4, x: 52, y: 70 },
  { id: "senderismo", name: "Senderos", icon: "map", unitCount: 10, x: 69, y: 13 },
  { id: "juegos", name: "Juegos", icon: "smile", unitCount: 12, x: 21, y: 73 },
  { id: "parqueadero", name: "Parqueo", icon: "building", unitCount: 8, x: 83.5, y: 79 },
];

export function placeTracksGuests(place: BookingPlace) {
  return place.trackGuests ?? (place.id === "glamping" || place.id === "acampar");
}

/** Recursos de cabañas / estadía (móvil y sitio público). */
export const CABANA_BOOKING_PLACE_IDS = ["glamping", "acampar"] as const;

export function filterCabanaPlaces(places: BookingPlace[]): BookingPlace[] {
  const allowed = new Set<string>(CABANA_BOOKING_PLACE_IDS);
  const filtered = places.filter((place) => allowed.has(place.id));
  if (filtered.length) return filtered;
  return DEFAULT_BOOKING_PLACES.filter((place) => allowed.has(place.id));
}

export function normalizeBookingPlaces(raw: unknown): BookingPlace[] {
  const parsed = z.array(bookingPlaceSchema).safeParse(raw);
  if (parsed.success && parsed.data.length) {
    return parsed.data.map((place) => ({
      ...place,
      trackGuests: place.trackGuests ?? (place.id === "glamping" || place.id === "acampar"),
    }));
  }
  return DEFAULT_BOOKING_PLACES;
}

export const bookingSettingsSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  mode: z.enum(BOOKING_MODES).optional(),
  slotMinutes: z.number().int().min(5).max(24 * 60).optional(),
  bufferMinutes: z.number().int().min(0).max(180).optional(),
  maxPerSlot: z.number().int().min(1).max(50).optional(),
  maxPerDay: z.number().int().min(1).max(500).optional(),
  horizonDays: z.number().int().min(1).max(180).optional(),
  weeklyHours: bookingWeeklyHoursSchema.optional(),
  customFields: z.array(bookingCustomFieldSchema).max(20).optional(),
  places: z.array(bookingPlaceSchema).max(20).optional(),
  confirmationMessage: z.string().max(800).optional().nullable(),
  cancelPolicy: z.string().max(800).optional().nullable(),
  bookableServiceIds: z.array(z.string().min(1)).optional(),
  bookableProductIds: z.array(z.string().min(1)).optional(),
  requirePhone: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  autoConfirm: z.boolean().optional(),
  allowBotBooking: z.boolean().optional(),
  depositPercent: z.number().int().min(1).max(100).optional(),
});

export const createBookingSchema = z
  .object({
    customerName: z.string().min(1).max(160),
    customerPhone: z.string().max(40).optional().nullable(),
    customerEmail: z.string().email().max(160).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    serviceId: z.string().cuid().optional().nullable(),
    productId: z.string().cuid().optional().nullable(),
    source: z.enum(["PANEL", "BOT", "MANUAL"]).optional(),
    paymentStatus: z.enum(BOOKING_PAYMENT_STATUSES).optional(),
  })
  .refine((v) => v.serviceId || v.productId, {
    message: "Elige un servicio o un producto",
  });

export const updateBookingSchema = z.object({
  customerName: z.string().min(1).max(160).optional(),
  customerPhone: z.string().max(40).optional().nullable(),
  customerEmail: z.string().email().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  serviceId: z.string().cuid().optional().nullable(),
  productId: z.string().cuid().optional().nullable(),
  status: z.enum(BOOKING_STATUSES).optional(),
  paymentStatus: z.enum(BOOKING_PAYMENT_STATUSES).optional(),
});

export const toggleBookingsSchema = z.object({
  bookingsEnabled: z.boolean(),
});

export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type ToggleBookingsInput = z.infer<typeof toggleBookingsSchema>;
export type BookingWeeklyHours = z.infer<typeof bookingWeeklyHoursSchema>;
export type BookingCustomField = z.infer<typeof bookingCustomFieldSchema>;
