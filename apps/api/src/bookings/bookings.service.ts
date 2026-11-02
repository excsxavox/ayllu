import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookingSettingsInput,
  CreateBookingInput,
  UpdateBookingInput,
  DEFAULT_BOOKING_PLACES,
  filterCabanaPlaces,
  normalizeBookingPlaces,
  type BookingCustomField,
  type BookingWeeklyHours,
} from "@aylluu/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DEFAULT_HOURS: BookingWeeklyHours = {
  mon: [{ start: "09:00", end: "18:00" }],
  tue: [{ start: "09:00", end: "18:00" }],
  wed: [{ start: "09:00", end: "18:00" }],
  thu: [{ start: "09:00", end: "18:00" }],
  fri: [{ start: "09:00", end: "18:00" }],
  sat: [{ start: "09:00", end: "13:00" }],
  sun: [{ start: "09:00", end: "13:00" }],
};

const bookingInclude = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  product: { select: { id: true, name: true } },
} as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async assertEnabled(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { bookingsEnabled: true, timezone: true, name: true },
    });
    if (!company) throw new NotFoundException("Empresa no encontrada");
    if (!company.bookingsEnabled) {
      throw new ForbiddenException(
        "El módulo de reservas no está activo. Un administrador de AYLLUU debe activarlo para el plan contratado.",
      );
    }
    return company;
  }

  async isEnabled(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { bookingsEnabled: true },
    });
    return Boolean(company?.bookingsEnabled);
  }

  async getSettings(companyId: string) {
    await this.assertEnabled(companyId);
    return this.presentSettings(await this.ensureSettings(companyId));
  }

  async updateSettings(companyId: string, userId: string, input: BookingSettingsInput) {
    await this.assertEnabled(companyId);
    await this.ensureSettings(companyId);
    const settings = await this.prisma.bookingSettings.update({
      where: { companyId },
      data: {
        ...input,
        weeklyHours: input.weeklyHours as Prisma.InputJsonValue | undefined,
        customFields: input.customFields as Prisma.InputJsonValue | undefined,
        places: input.places as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({
      userId,
      companyId,
      action: "bookings.settings.update",
      entity: "BookingSettings",
      entityId: settings.id,
    });
    return this.presentSettings(settings);
  }

  async list(companyId: string, from?: string, to?: string) {
    await this.assertEnabled(companyId);
    return this.prisma.booking.findMany({
      where: {
        companyId,
        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: bookingInclude,
      orderBy: { startsAt: "desc" },
      take: 500,
    });
  }

  async floor(companyId: string, date: string) {
    const company = await this.assertEnabled(companyId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException("Usa una fecha YYYY-MM-DD");
    }
    const start = this.companyLocalToUtc(date, "00:00", company.timezone);
    const next = this.nextCalendarDay(date);
    const end = this.companyLocalToUtc(next, "00:00", company.timezone);
    const [bookings, pack, settings] = await Promise.all([
      this.prisma.booking.findMany({
        where: { companyId, startsAt: { gte: start, lt: end } },
        include: bookingInclude,
        orderBy: { startsAt: "asc" },
      }),
      this.slots(companyId, date),
      this.ensureSettings(companyId),
    ]);
    return {
      date,
      timezone: company.timezone,
      companyName: company.name,
      bookings,
      slots: pack.slots,
      booked: pack.booked,
      maxPerDay: pack.maxPerDay,
      remaining: pack.remaining,
      places: normalizeBookingPlaces(settings.places),
    };
  }

  async create(companyId: string, userId: string, input: CreateBookingInput) {
    const company = await this.assertEnabled(companyId);
    const settings = await this.ensureSettings(companyId);
    const { startsAt, endsAt, service, product } = await this.resolveWindow(
      companyId,
      settings,
      input,
    );
    this.validateHours(settings, startsAt, company.timezone);
    this.assertOpenDates(settings, startsAt, endsAt, company.timezone);
    if (input.source !== "MANUAL") {
      await this.assertCapacity(companyId, settings, startsAt, endsAt);
      await this.assertDayCapacity(companyId, settings, startsAt, company.timezone);
    }
    await this.assertAddonStock(companyId, product, startsAt, endsAt);

    const phone = (input.customerPhone ?? "").trim();
    if (settings.requirePhone && !phone) {
      throw new BadRequestException("El teléfono es obligatorio en esta reserva");
    }
    if (settings.requireEmail && !input.customerEmail) {
      throw new BadRequestException("El correo es obligatorio en esta reserva");
    }
    this.validateAnswers(settings, input.answers);

    const contact = phone
      ? await this.prisma.contact.findUnique({
          where: { companyId_phone: { companyId, phone } },
          select: { id: true },
        })
      : null;

    const booking = await this.prisma.booking.create({
      data: {
        companyId,
        contactId: contact?.id,
        productId: product?.id ?? null,
        serviceId: service?.id ?? null,
        customerName: input.customerName.trim(),
        customerPhone: phone,
        customerEmail: input.customerEmail ?? null,
        notes: input.notes ?? null,
        answers: (input.answers ?? {}) as Prisma.InputJsonValue,
        startsAt,
        endsAt,
        status: input.source === "MANUAL" || settings.autoConfirm ? "CONFIRMED" : "PENDING",
        paymentStatus: input.paymentStatus ?? "PENDING",
        source: input.source ?? "PANEL",
      },
      include: bookingInclude,
    });
    await this.audit.log({
      userId,
      companyId,
      action: "bookings.create",
      entity: "Booking",
      entityId: booking.id,
    });
    await this.advanceCrm(contact?.id, booking.status === "COMPLETED" ? "WON" : "RESERVED");
    return booking;
  }

  async update(companyId: string, userId: string, id: string, input: UpdateBookingInput) {
    await this.assertEnabled(companyId);
    const current = await this.prisma.booking.findFirst({ where: { id, companyId } });
    if (!current) throw new NotFoundException("Reserva no encontrada");
    const settings = await this.ensureSettings(companyId);

    const nextStarts = input.startsAt ? new Date(input.startsAt) : current.startsAt;
    const nextEnds = input.endsAt
      ? new Date(input.endsAt)
      : input.startsAt
        ? new Date(nextStarts.getTime() + (current.endsAt.getTime() - current.startsAt.getTime()))
        : current.endsAt;
    if (nextEnds <= nextStarts) throw new BadRequestException("La hora de fin debe ser posterior al inicio");

    if (input.startsAt || input.endsAt) {
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { timezone: true },
      });
      this.assertOpenDates(settings, nextStarts, nextEnds, company.timezone);
      await this.assertCapacity(companyId, settings, nextStarts, nextEnds, id);
      await this.assertDayCapacity(companyId, settings, nextStarts, company.timezone, id);
    }
    if (input.answers) this.validateAnswers(settings, input.answers);

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        customerName: input.customerName?.trim(),
        customerPhone: input.customerPhone ?? undefined,
        customerEmail: input.customerEmail === undefined ? undefined : input.customerEmail,
        notes: input.notes === undefined ? undefined : input.notes,
        answers: input.answers as Prisma.InputJsonValue | undefined,
        startsAt: input.startsAt ? nextStarts : undefined,
        endsAt: input.startsAt || input.endsAt ? nextEnds : undefined,
        serviceId: input.serviceId === undefined ? undefined : input.serviceId,
        productId: input.productId === undefined ? undefined : input.productId,
        status: input.status,
        paymentStatus: input.paymentStatus,
      },
      include: bookingInclude,
    });
    await this.audit.log({
      userId,
      companyId,
      action: "bookings.update",
      entity: "Booking",
      entityId: booking.id,
    });
    if (booking.contactId) {
      if (booking.status === "COMPLETED") await this.advanceCrm(booking.contactId, "WON");
      else if (booking.status === "PENDING" || booking.status === "CONFIRMED") {
        await this.advanceCrm(booking.contactId, "RESERVED");
      }
    }
    return booking;
  }

  async remove(companyId: string, userId: string, id: string) {
    await this.assertEnabled(companyId);
    const current = await this.prisma.booking.findFirst({ where: { id, companyId } });
    if (!current) throw new NotFoundException("Reserva no encontrada");
    await this.prisma.booking.delete({ where: { id } });
    await this.audit.log({
      userId,
      companyId,
      action: "bookings.delete",
      entity: "Booking",
      entityId: id,
    });
    return { ok: true };
  }

  async slots(companyId: string, date: string, serviceId?: string, productId?: string) {
    const company = await this.assertEnabled(companyId);
    const settings = await this.ensureSettings(companyId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException("Usa una fecha YYYY-MM-DD");
    }
    if (this.normalizeClosedDates(settings.closedDates).includes(date)) {
      return {
        date,
        durationMinutes: 0,
        slots: [],
        booked: 0,
        maxPerDay: settings.maxPerDay,
        remaining: 0,
        closed: true,
      };
    }

    const duration = await this.itemDuration(companyId, settings, serviceId, productId);
    const weekday = WEEKDAYS[this.weekdayInZone(date, company.timezone)];
    const windows = this.hoursOf(settings, weekday);
    const dayStart = this.companyLocalToUtc(date, "00:00", company.timezone);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existing = await this.prisma.booking.findMany({
      where: {
        companyId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    const booked = existing.length;
    if (booked >= settings.maxPerDay) {
      return {
        date,
        durationMinutes: duration,
        slots: [],
        booked,
        maxPerDay: settings.maxPerDay,
        remaining: 0,
      };
    }

    const slots: Array<{ start: string; end: string }> = [];
    for (const window of windows) {
      let cursor = this.companyLocalToUtc(date, window.start, company.timezone);
      const windowEnd = this.companyLocalToUtc(date, window.end, company.timezone);
      while (cursor.getTime() + duration * 60_000 <= windowEnd.getTime()) {
        const end = new Date(cursor.getTime() + duration * 60_000);
        const taken = existing.filter((b) => b.startsAt < end && b.endsAt > cursor).length;
        if (taken < settings.maxPerSlot) {
          slots.push({ start: cursor.toISOString(), end: end.toISOString() });
        }
        cursor = new Date(cursor.getTime() + (settings.slotMinutes + settings.bufferMinutes) * 60_000);
      }
    }
    return {
      date,
      durationMinutes: duration,
      slots,
      booked,
      maxPerDay: settings.maxPerDay,
      remaining: Math.max(0, settings.maxPerDay - booked),
    };
  }

  /**
   * Agenda pública para el sitio: mismos places/unitCount del móvil
   * y ocupación del día (tags [u:placeId:n] o reservas que nombran el recurso).
   */
  async publicAgenda(slug: string, from: string, to: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException("Usa fechas YYYY-MM-DD");
    }
    if (from > to) throw new BadRequestException("El rango de fechas no es válido");
    const company = await this.prisma.company.findFirst({
      where: { slug, bookingsEnabled: true },
      select: { id: true, name: true, slug: true, timezone: true },
    });
    if (!company) throw new NotFoundException("Empresa no encontrada");
    const settings = await this.ensureSettings(company.id);
    const places = filterCabanaPlaces(normalizeBookingPlaces(settings.places));
    const horizon = Math.max(1, Math.min(180, settings.horizonDays || 14));
    const today = this.calendarDateInZone(new Date(), company.timezone);
    const maxDay = this.addCalendarDays(today, horizon - 1);
    const startDay = from < today ? today : from;
    const endDay = to > maxDay ? maxDay : to;
    if (startDay > endDay) {
      return {
        company: { name: company.name, slug: company.slug, timezone: company.timezone },
        places: places.map((place) => ({
          id: place.id,
          name: place.name,
          unitCount: place.unitCount,
          trackGuests: place.trackGuests ?? false,
        })),
        days: {} as Record<string, Record<string, { unitCount: number; free: number; occupied: number }>>,
        from: startDay,
        to: endDay,
        horizonDays: horizon,
      };
    }

    const rangeStart = this.companyLocalToUtc(startDay, "00:00", company.timezone);
    const rangeEnd = this.companyLocalToUtc(this.nextCalendarDay(endDay), "00:00", company.timezone);
    const rows = await this.prisma.booking.findMany({
      where: {
        companyId: company.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        id: true,
        startsAt: true,
        notes: true,
        service: { select: { name: true } },
        product: { select: { name: true } },
      },
    });

    const closed = new Set(this.normalizeClosedDates(settings.closedDates));
    const days: Record<
      string,
      Record<string, { unitCount: number; free: number; occupied: number; closed?: boolean }>
    > = {};
    for (let day = startDay; day <= endDay; day = this.nextCalendarDay(day)) {
      days[day] = {};
      const isClosed = closed.has(day);
      for (const place of places) {
        days[day][place.id] = isClosed
          ? { unitCount: place.unitCount, free: 0, occupied: place.unitCount, closed: true }
          : { unitCount: place.unitCount, free: place.unitCount, occupied: 0, closed: false };
      }
    }

    const takenByDay = new Map<string, Map<string, Set<string>>>();
    for (const row of rows) {
      const day = this.calendarDateInZone(row.startsAt, company.timezone);
      if (!days[day]) continue;
      const blob = `${row.notes ?? ""} ${row.service?.name ?? ""} ${row.product?.name ?? ""}`;
      for (const place of places) {
        if (!this.blobUsesPlace(place, blob)) continue;
        if (!takenByDay.has(day)) takenByDay.set(day, new Map());
        const byPlace = takenByDay.get(day)!;
        if (!byPlace.has(place.id)) byPlace.set(place.id, new Set());
        const set = byPlace.get(place.id)!;
        const tagged = [...blob.matchAll(new RegExp(`\\[u:${place.id}:(\\d+)\\]`, "gi"))].map((m) => m[1]);
        if (tagged.length) tagged.forEach((id) => set.add(id));
        else set.add(`b:${row.id}`);
      }
    }

    for (const [day, byPlace] of takenByDay) {
      for (const [placeId, set] of byPlace) {
        const cell = days[day]?.[placeId];
        if (!cell) continue;
        cell.occupied = Math.min(cell.unitCount, set.size);
        cell.free = Math.max(0, cell.unitCount - cell.occupied);
      }
    }

    return {
      company: { name: company.name, slug: company.slug, timezone: company.timezone },
      places: places.map((place) => ({
        id: place.id,
        name: place.name,
        unitCount: place.unitCount,
        trackGuests: place.trackGuests ?? false,
      })),
      days,
      closedDates: [...closed].filter((d) => d >= startDay && d <= endDay).sort(),
      from: startDay,
      to: endDay,
      horizonDays: horizon,
    };
  }

  /** Recursos creados en la app (glamping, botes…) y las reservas vivas de ese día. */
  async dayResources(companyId: string, date: string) {
    const enabled = await this.isEnabled(companyId);
    if (!enabled) return null;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    if (!company || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const settings = await this.ensureSettings(companyId);
    const start = this.companyLocalToUtc(date, "00:00", company.timezone);
    const end = this.companyLocalToUtc(this.nextCalendarDay(date), "00:00", company.timezone);
    const rows = await this.prisma.booking.findMany({
      where: {
        companyId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: { gte: start, lt: end },
      },
      select: { notes: true, service: { select: { name: true } }, product: { select: { name: true } } },
    });
    return {
      places: normalizeBookingPlaces(settings.places),
      occupied: rows.map((row) => `${row.notes ?? ""} ${row.service?.name ?? ""} ${row.product?.name ?? ""}`),
    };
  }

  async botContext(companyId: string) {
    const enabled = await this.isEnabled(companyId);
    if (!enabled) return null;
    const settings = await this.ensureSettings(companyId);
    const items = await this.bookableItems(companyId, settings);
    const hours = this.formatHours(settings);
    return {
      title: settings.title,
      confirmationMessage: settings.confirmationMessage,
      cancelPolicy: settings.cancelPolicy,
      allowBotBooking: settings.allowBotBooking,
      depositPercent: settings.depositPercent ?? 50,
      hours,
      items,
      maxPerDay: settings.maxPerDay,
      closedDates: this.normalizeClosedDates(settings.closedDates),
    };
  }

  private async ensureSettings(companyId: string) {
    return this.prisma.bookingSettings.upsert({
      where: { companyId },
      update: {},
      create: {
        companyId,
        weeklyHours: DEFAULT_HOURS as Prisma.InputJsonValue,
        places: DEFAULT_BOOKING_PLACES as Prisma.InputJsonValue,
      },
    });
  }

  private presentSettings(settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>) {
    return {
      ...settings,
      places: normalizeBookingPlaces(settings.places),
      closedDates: this.normalizeClosedDates(settings.closedDates),
    };
  }

  private normalizeClosedDates(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return [
      ...new Set(
        raw
          .map((d) => String(d ?? "").trim())
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
      ),
    ].sort();
  }

  private assertOpenDates(
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    startsAt: Date,
    endsAt: Date,
    timezone: string,
  ) {
    const closed = new Set(this.normalizeClosedDates(settings.closedDates));
    if (!closed.size) return;
    const startDay = this.calendarDateInZone(startsAt, timezone);
    // Estadía: noches desde startsAt hasta el día anterior a endsAt (si endsAt es checkout).
    // Para un día puntual (mismo día) solo se valida startsAt.
    const endExclusive = this.calendarDateInZone(endsAt, timezone);
    const lastNight =
      endExclusive > startDay ? this.addCalendarDays(endExclusive, -1) : startDay;
    for (let day = startDay; day <= lastNight; day = this.nextCalendarDay(day)) {
      if (closed.has(day)) {
        throw new BadRequestException(`El ${day} está cerrado a visitas y no admite reservas`);
      }
    }
  }

  private async resolveWindow(
    companyId: string,
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    input: CreateBookingInput,
  ) {
    if (settings.mode === "SERVICES" && !input.serviceId) {
      throw new BadRequestException("Esta agenda solo acepta servicios");
    }
    if (settings.mode === "PRODUCTS" && !input.productId) {
      throw new BadRequestException("Esta agenda solo acepta productos");
    }

    const service = input.serviceId
      ? await this.prisma.service.findFirst({
          where: { id: input.serviceId, companyId, isActive: true },
        })
      : null;
    if (input.serviceId && !service) throw new NotFoundException("Servicio no encontrado");
    if (service && settings.bookableServiceIds.length && !settings.bookableServiceIds.includes(service.id)) {
      throw new BadRequestException("Ese servicio no está habilitado para reservas");
    }

    const product = input.productId
      ? await this.prisma.product.findFirst({
          where: { id: input.productId, companyId, isActive: true },
        })
      : null;
    if (input.productId && !product) throw new NotFoundException("Producto no encontrado");
    if (product && settings.bookableProductIds.length && !settings.bookableProductIds.includes(product.id)) {
      throw new BadRequestException("Ese producto no está habilitado para reservas");
    }
    if (product?.isAddon) {
      if (!service || product.parentServiceId !== service.id) {
        throw new BadRequestException("Ese implemento solo se reserva junto con su servicio");
      }
    } else if (product && settings.mode === "SERVICES") {
      throw new BadRequestException("Ese producto no se reserva como cita");
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException("Fecha inválida");
    const duration =
      service?.durationMinutes && service.durationMinutes > 0
        ? service.durationMinutes
        : settings.slotMinutes;
    const endsAt = input.endsAt ? new Date(input.endsAt) : new Date(startsAt.getTime() + duration * 60_000);
    if (endsAt <= startsAt) throw new BadRequestException("La hora de fin debe ser posterior al inicio");
    return { startsAt, endsAt, service, product };
  }

  private async itemDuration(
    companyId: string,
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    serviceId?: string,
    productId?: string,
  ) {
    if (serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: serviceId, companyId },
        select: { durationMinutes: true },
      });
      if (service?.durationMinutes && service.durationMinutes > 0) return service.durationMinutes;
    }
    void productId;
    return settings.slotMinutes;
  }

  private async assertCapacity(
    companyId: string,
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    startsAt: Date,
    endsAt: Date,
    ignoreId?: string,
  ) {
    const taken = await this.prisma.booking.count({
      where: {
        companyId,
        status: { in: ["PENDING", "CONFIRMED"] },
        id: ignoreId ? { not: ignoreId } : undefined,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (taken >= settings.maxPerSlot) {
      throw new BadRequestException("Ese horario ya no tiene cupo");
    }
  }

  private async assertDayCapacity(
    companyId: string,
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    startsAt: Date,
    timezone: string,
    ignoreId?: string,
  ) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(startsAt);
    const dayStart = this.companyLocalToUtc(date, "00:00", timezone);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const booked = await this.prisma.booking.count({
      where: {
        companyId,
        status: { in: ["PENDING", "CONFIRMED"] },
        id: ignoreId ? { not: ignoreId } : undefined,
        startsAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (booked >= settings.maxPerDay) {
      throw new BadRequestException(
        `Ese día ya llegó al máximo de ${settings.maxPerDay} reservas`,
      );
    }
  }

  private validateHours(
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    startsAt: Date,
    timezone: string,
  ) {
    const weekday = WEEKDAYS[this.weekdayFromInstant(startsAt, timezone)];
    const windows = this.hoursOf(settings, weekday);
    if (!windows.length) {
      throw new BadRequestException("Ese día no acepta reservas");
    }
    const hm = this.clockInZone(startsAt, timezone);
    const ok = windows.some((w) => hm >= w.start && hm < w.end);
    if (!ok) throw new BadRequestException("Esa hora está fuera del horario de reservas");
  }

  private validateAnswers(
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    answers?: Record<string, string | number | boolean>,
  ) {
    const fields = (settings.customFields as BookingCustomField[] | null) ?? [];
    for (const field of fields) {
      const value = answers?.[field.key];
      if (field.required && (value === undefined || value === "")) {
        throw new BadRequestException(`Falta el campo ${field.label}`);
      }
    }
  }

  private hoursOf(
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
    weekday: (typeof WEEKDAYS)[number],
  ) {
    const hours = (settings.weeklyHours ?? {}) as BookingWeeklyHours;
    return hours[weekday] ?? [];
  }

  private formatHours(settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>) {
    const labels: Record<(typeof WEEKDAYS)[number], string> = {
      mon: "Lunes",
      tue: "Martes",
      wed: "Miércoles",
      thu: "Jueves",
      fri: "Viernes",
      sat: "Sábado",
      sun: "Domingo",
    };
    const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
    return order.map((day) => {
        const windows = this.hoursOf(settings, day);
        return `${labels[day]}: ${
          windows.length ? windows.map((w) => `${w.start}-${w.end}`).join(", ") : "cerrado"
        }`;
      });
  }

  private async bookableItems(
    companyId: string,
    settings: Awaited<ReturnType<BookingsService["ensureSettings"]>>,
  ) {
    const services =
      settings.mode === "PRODUCTS"
        ? []
        : await this.prisma.service.findMany({
            where: {
              companyId,
              isActive: true,
              ...(settings.bookableServiceIds.length
                ? { id: { in: settings.bookableServiceIds } }
                : {}),
            },
            select: { name: true, durationMinutes: true, description: true },
            take: 20,
          });
    const products =
      settings.mode === "SERVICES"
        ? []
        : await this.prisma.product.findMany({
            where: {
              companyId,
              isActive: true,
              isAddon: false,
              ...(settings.bookableProductIds.length
                ? { id: { in: settings.bookableProductIds } }
                : {}),
            },
            select: { name: true, description: true },
            take: 20,
          });
    const addons = await this.prisma.product.findMany({
      where: { companyId, isActive: true, isAddon: true },
      select: {
        name: true,
        stock: true,
        parentService: { select: { name: true } },
      },
      take: 20,
    });
    return {
      services: services.map((s) => `${s.name}${s.durationMinutes ? ` (${s.durationMinutes} min)` : ""}`),
      products: products.map((p) => p.name),
      addons: addons.map((p) => {
        const parent = p.parentService?.name ?? "su servicio";
        const stock = p.stock != null ? `, stock ${p.stock}` : "";
        return `${p.name} (solo con ${parent}${stock}; no se ofrece suelto)`;
      }),
    };
  }

  private async assertAddonStock(
    companyId: string,
    product: { id: string; isAddon: boolean; stock: number | null; name: string } | null,
    startsAt: Date,
    endsAt: Date,
    ignoreId?: string,
  ) {
    if (!product?.isAddon || product.stock == null) return;
    const used = await this.prisma.booking.count({
      where: {
        companyId,
        productId: product.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        id: ignoreId ? { not: ignoreId } : undefined,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (used >= product.stock) {
      throw new BadRequestException(`No hay más ${product.name} disponibles en ese horario`);
    }
  }

  private weekdayInZone(date: string, timeZone: string) {
    const instant = this.companyLocalToUtc(date, "12:00", timeZone);
    return this.weekdayFromInstant(instant, timeZone);
  }

  private weekdayFromInstant(instant: Date, timeZone: string) {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[weekday] ?? instant.getUTCDay();
  }

  private clockInZone(instant: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  }

  private offsetMinutes(timeZone: string, instant: Date) {
    const name =
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
        hour: "numeric",
      })
        .formatToParts(instant)
        .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const match = name.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  }

  private nextCalendarDay(date: string) {
    return this.addCalendarDays(date, 1);
  }

  private addCalendarDays(date: string, days: number) {
    const [year, month, day] = date.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    const d = String(next.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private calendarDateInZone(instant: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  private blobUsesPlace(place: { id: string; name: string }, blob: string) {
    const text = blob
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const id = place.id.toLowerCase();
    if (text.includes(`[u:${id}:`)) return true;
    const bits = place.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2);
    return [id, ...bits].some((key) => key && text.includes(key));
  }

  private companyLocalToUtc(date: string, time: string, timeZone: string) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const offset = this.offsetMinutes(timeZone, new Date(guess));
    return new Date(guess - offset * 60_000);
  }

  private async advanceCrm(contactId: string | undefined, stage: "RESERVED" | "WON" | "LOST") {
    if (!contactId) return;
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { stage: true },
    });
    if (!contact) return;
    if (stage === "RESERVED" && (contact.stage === "RESERVED" || contact.stage === "WON" || contact.stage === "LOST")) {
      return;
    }
    if (stage === "WON" && contact.stage === "LOST") return;
    if (stage === "LOST" && contact.stage === "WON") return;
    await this.prisma.contact.update({ where: { id: contactId }, data: { stage } });
  }
}
