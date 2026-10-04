import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BookingsService } from "./bookings.service";

const COMPANY = "empresa-a";
const USER = "user-a";
const SERVICE = "cmtp2jx99000euh1c44zk95hw";

const mondayMorningLima = "2026-09-07T14:00:00.000Z";

function settings(over: Record<string, unknown> = {}) {
  return {
    id: "set-1",
    companyId: COMPANY,
    title: "Reservas",
    mode: "SERVICES",
    slotMinutes: 30,
    bufferMinutes: 0,
    maxPerSlot: 1,
    maxPerDay: 8,
    horizonDays: 14,
    weeklyHours: {
      mon: [{ start: "09:00", end: "18:00" }],
      tue: [{ start: "09:00", end: "18:00" }],
      wed: [{ start: "09:00", end: "18:00" }],
      thu: [{ start: "09:00", end: "18:00" }],
      fri: [{ start: "09:00", end: "18:00" }],
      sat: [{ start: "09:00", end: "13:00" }],
      sun: [{ start: "09:00", end: "13:00" }],
    },
    customFields: [],
    confirmationMessage: null,
    cancelPolicy: null,
    bookableServiceIds: [],
    bookableProductIds: [],
    requirePhone: true,
    requireEmail: false,
    autoConfirm: false,
    allowBotBooking: true,
    depositPercent: 50,
    ...over,
  };
}

function makeService(prisma: Record<string, unknown>, audit = { log: jest.fn() }) {
  return new BookingsService(prisma as never, audit as never);
}

describe("BookingsService", () => {
  it("rechaza si la empresa no existe", async () => {
    const service = makeService({
      company: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.assertEnabled(COMPANY)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("bloquea el módulo si el plan no está activo", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: false,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
    });
    await expect(service.assertEnabled(COMPANY)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list(COMPANY)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("isEnabled refleja el flag del plan", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ bookingsEnabled: true })
      .mockResolvedValueOnce({ bookingsEnabled: false })
      .mockResolvedValueOnce(null);
    const service = makeService({ company: { findUnique } });
    await expect(service.isEnabled(COMPANY)).resolves.toBe(true);
    await expect(service.isEnabled(COMPANY)).resolves.toBe(false);
    await expect(service.isEnabled(COMPANY)).resolves.toBe(false);
  });

  it("botContext es null si el extra está apagado", async () => {
    const service = makeService({
      company: { findUnique: jest.fn().mockResolvedValue({ bookingsEnabled: false }) },
    });
    await expect(service.botContext(COMPANY)).resolves.toBeNull();
  });

  it("botContext incluye tope diario y catálogo cuando está activo", async () => {
    const service = makeService({
      company: { findUnique: jest.fn().mockResolvedValue({ bookingsEnabled: true }) },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      service: { findMany: jest.fn().mockResolvedValue([{ name: "Limpieza facial", durationMinutes: 60 }]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const ctx = await service.botContext(COMPANY);
    expect(ctx?.maxPerDay).toBe(8);
    expect(ctx?.depositPercent).toBe(50);
    expect(ctx?.items.services).toContain("Limpieza facial (60 min)");
    expect(ctx?.items.addons).toEqual([]);
    expect(ctx?.hours.some((h) => h.startsWith("Lunes:"))).toBe(true);
  });

  it("botContext lista complementos sin ofrecerlos como producto principal", async () => {
    const service = makeService({
      company: { findUnique: jest.fn().mockResolvedValue({ bookingsEnabled: true }) },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      service: { findMany: jest.fn().mockResolvedValue([{ name: "Acampar", durationMinutes: 60 }]) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { name: "Tienda de campaña", stock: 5, parentService: { name: "Acampar" } },
        ]),
      },
    });
    const ctx = await service.botContext(COMPANY);
    expect(ctx?.items.products).toEqual([]);
    expect(ctx?.items.addons).toContain("Tienda de campaña (solo con Acampar, stock 5; no se ofrece suelto)");
  });

  it("no crea reserva sin teléfono si es obligatorio", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 60, companyId: COMPANY }),
      },
      booking: { count: jest.fn().mockResolvedValue(0) },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        startsAt: mondayMorningLima,
        serviceId: SERVICE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("no crea reserva fuera de horario", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 60, companyId: COMPANY }),
      },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: "2026-09-07T03:00:00.000Z",
        serviceId: SERVICE,
      }),
    ).rejects.toMatchObject({ message: "Esa hora está fuera del horario de reservas" });
  });

  it("no reserva un complemento sin su servicio", async () => {
    const TENT = "cmtp2jx99000euh1c44zk95hw";
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: TENT,
          isAddon: true,
          stock: 5,
          parentServiceId: "otro-servicio",
          name: "Tienda de campaña",
        }),
      },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: mondayMorningLima,
        productId: TENT,
      }),
    ).rejects.toMatchObject({ message: "Esta agenda solo acepta servicios" });
  });

  it("rechaza el complemento si ya no hay stock en ese horario", async () => {
    const TENT = "cmtp2jx99000euh1c44zk95hw";
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 60, companyId: COMPANY }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: TENT,
          isAddon: true,
          stock: 5,
          parentServiceId: SERVICE,
          name: "Tienda de campaña",
        }),
      },
      booking: { count: jest.fn().mockResolvedValue(5) },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: mondayMorningLima,
        serviceId: SERVICE,
        productId: TENT,
        source: "MANUAL",
      }),
    ).rejects.toMatchObject({ message: "No hay más Tienda de campaña disponibles en ese horario" });
  });

  it("exige servicio cuando el modo es SERVICES", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: mondayMorningLima,
        productId: "cmtp2jx99000euh1c44zk95hw",
      }),
    ).rejects.toMatchObject({ message: "Esta agenda solo acepta servicios" });
  });

  it("rechaza si el día ya llegó al máximo", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings({ maxPerDay: 2 })) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 30, companyId: COMPANY }),
      },
      booking: { count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(2) },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: mondayMorningLima,
        serviceId: SERVICE,
      }),
    ).rejects.toMatchObject({ message: "Ese día ya llegó al máximo de 2 reservas" });
  });

  it("rechaza si el horario ya no tiene cupo", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings({ maxPerSlot: 1 })) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 30, companyId: COMPANY }),
      },
      booking: { count: jest.fn().mockResolvedValue(1) },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: mondayMorningLima,
        serviceId: SERVICE,
      }),
    ).rejects.toMatchObject({ message: "Ese horario ya no tiene cupo" });
  });

  it("exige campos personalizados obligatorios", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: {
        upsert: jest.fn().mockResolvedValue(
          settings({
            customFields: [{ key: "motivo", label: "Motivo", type: "text", required: true }],
          }),
        ),
      },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 30, companyId: COMPANY }),
      },
      booking: { count: jest.fn().mockResolvedValue(0) },
    });
    await expect(
      service.create(COMPANY, USER, {
        customerName: "Ana Pérez",
        customerPhone: "999111001",
        startsAt: mondayMorningLima,
        serviceId: SERVICE,
        answers: {},
      }),
    ).rejects.toMatchObject({ message: "Falta el campo Motivo" });
  });

  it("crea la reserva con pago y deja PENDING si no auto-confirma", async () => {
    const create = jest.fn().mockResolvedValue({ id: "b1", paymentStatus: "PAID" });
    const log = jest.fn();
    const service = makeService(
      {
        company: {
          findUnique: jest.fn().mockResolvedValue({
            bookingsEnabled: true,
            timezone: "America/Lima",
            name: "Alpha",
          }),
        },
        bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
        service: {
          findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 60, companyId: COMPANY }),
        },
        booking: { count: jest.fn().mockResolvedValue(0), create },
        contact: { findUnique: jest.fn().mockResolvedValue(null) },
      },
      { log },
    );

    await service.create(COMPANY, USER, {
      customerName: " Ana Pérez ",
      customerPhone: "999111001",
      startsAt: mondayMorningLima,
      serviceId: SERVICE,
      paymentStatus: "PAID",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: "Ana Pérez",
          status: "PENDING",
          paymentStatus: "PAID",
          serviceId: SERVICE,
        }),
      }),
    );
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: "bookings.create" }));
  });

  it("confirma sola si autoConfirm está activo", async () => {
    const create = jest.fn().mockResolvedValue({ id: "b2" });
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings({ autoConfirm: true })) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ id: SERVICE, durationMinutes: 30, companyId: COMPANY }),
      },
      booking: { count: jest.fn().mockResolvedValue(0), create },
      contact: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await service.create(COMPANY, USER, {
      customerName: "Luis Romero",
      customerPhone: "999111002",
      startsAt: mondayMorningLima,
      serviceId: SERVICE,
    });
    expect(create.mock.calls[0][0].data.status).toBe("CONFIRMED");
    expect(create.mock.calls[0][0].data.paymentStatus).toBe("PENDING");
  });

  it("slots exige fecha YYYY-MM-DD", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
    });
    await expect(service.slots(COMPANY, "07-09-2026")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("slots queda vacío si el día está lleno", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings({ maxPerDay: 2 })) },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { startsAt: new Date(), endsAt: new Date() },
          { startsAt: new Date(), endsAt: new Date() },
        ]),
      },
    });
    const pack = await service.slots(COMPANY, "2026-09-07");
    expect(pack.slots).toEqual([]);
    expect(pack.remaining).toBe(0);
    expect(pack.booked).toBe(2);
  });

  it("slots genera huecos en horario de Lima", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: {
        upsert: jest.fn().mockResolvedValue(
          settings({
            slotMinutes: 60,
            weeklyHours: {
              mon: [{ start: "09:00", end: "11:00" }],
              tue: [],
              wed: [],
              thu: [],
              fri: [],
              sat: [],
              sun: [],
            },
          }),
        ),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const pack = await service.slots(COMPANY, "2026-09-07");
    expect(pack.slots).toHaveLength(2);
    expect(pack.slots[0].start).toBe("2026-09-07T14:00:00.000Z");
    expect(pack.remaining).toBe(8);
  });

  it("actualiza el estado de pago", async () => {
    const update = jest.fn().mockResolvedValue({ id: "b1", paymentStatus: "DEPOSIT" });
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      bookingSettings: { upsert: jest.fn().mockResolvedValue(settings()) },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: "b1",
          companyId: COMPANY,
          startsAt: new Date(mondayMorningLima),
          endsAt: new Date("2026-09-07T15:00:00.000Z"),
        }),
        update,
      },
    });
    await service.update(COMPANY, USER, "b1", { paymentStatus: "DEPOSIT" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: "DEPOSIT" }) }),
    );
  });

  it("no actualiza ni borra una reserva de otra empresa", async () => {
    const service = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue({
          bookingsEnabled: true,
          timezone: "America/Lima",
          name: "Alpha",
        }),
      },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.update(COMPANY, USER, "ajena", { status: "CANCELLED" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove(COMPANY, USER, "ajena")).rejects.toBeInstanceOf(NotFoundException);
  });
});
