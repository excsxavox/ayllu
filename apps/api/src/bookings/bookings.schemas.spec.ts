import {
  createBookingSchema,
  toggleBookingsSchema,
  updateBookingSchema,
  bookingSettingsSchema,
} from "@aylluu/shared";

const SERVICE = "cmtp2jx99000euh1c44zk95hw";

describe("Esquemas de reservas", () => {
  it("exige servicio o producto al crear", () => {
    const parsed = createBookingSchema.safeParse({
      customerName: "Ana Pérez",
      startsAt: "2026-09-07T14:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("acepta pago pagado, abonado o pendiente", () => {
    for (const paymentStatus of ["PENDING", "DEPOSIT", "PAID"] as const) {
      const parsed = createBookingSchema.safeParse({
        customerName: "Ana Pérez",
        startsAt: "2026-09-07T14:00:00.000Z",
        serviceId: SERVICE,
        paymentStatus,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rechaza un estado de pago inventado", () => {
    const parsed = updateBookingSchema.safeParse({ paymentStatus: "HALF" });
    expect(parsed.success).toBe(false);
  });

  it("el tope diario debe ser al menos 1", () => {
    expect(bookingSettingsSchema.safeParse({ maxPerDay: 0 }).success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ maxPerDay: 8 }).success).toBe(true);
  });

  it("solo un boolean activa el extra del plan", () => {
    expect(toggleBookingsSchema.safeParse({ bookingsEnabled: true }).success).toBe(true);
    expect(toggleBookingsSchema.safeParse({ bookingsEnabled: "si" }).success).toBe(false);
  });
});
