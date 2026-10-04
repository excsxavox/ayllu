"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";

type CatalogItem = {
  id: string;
  name: string;
  durationMinutes?: number | null;
  isActive: boolean;
  isAddon?: boolean;
  parentServiceId?: string | null;
  stock?: number | null;
};

type CustomField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "phone" | "email" | "number" | "select";
  required?: boolean;
  options?: string[];
};

type HoursSlot = { start: string; end: string };
type WeeklyHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", HoursSlot[]>;

export type BookingSettings = {
  title: string;
  mode: "SERVICES" | "PRODUCTS" | "BOTH";
  slotMinutes: number;
  maxPerDay: number;
  weeklyHours: WeeklyHours;
  customFields: CustomField[];
  bookableServiceIds: string[];
  bookableProductIds: string[];
  requirePhone: boolean;
  requireEmail: boolean;
};

type Booking = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  notes?: string | null;
  startsAt: string;
  endsAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  paymentStatus: "PENDING" | "DEPOSIT" | "PAID";
  service?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
};

type SlotPack = {
  date: string;
  slots: Array<{ start: string; end: string }>;
  booked: number;
  maxPerDay: number;
  remaining: number;
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
const WEEK_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const STATUS: Record<Booking["status"], string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Atendida",
  NO_SHOW: "No asistió",
};

const PAYMENT: Record<Booking["paymentStatus"], string> = {
  PENDING: "Pendiente",
  DEPOSIT: "Abonado",
  PAID: "Pagado",
};

const TONES = ["mint", "violet", "sky", "amber", "rose", "teal"] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymdParts(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymdParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function weekdayMon0(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthGrid(year: number, month: number): Array<string | null> {
  const first = ymdParts(year, month, 1);
  const lead = weekdayMon0(first);
  const count = daysInMonth(year, month);
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => ymdParts(year, month, i + 1)),
  ];
}

function dayInZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function todayInZone(timeZone: string) {
  return dayInZone(new Date().toISOString(), timeZone);
}

function formatClock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

const WEEKDAY_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

function prettyDay(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  return `${WEEKDAY_LONG[weekdayMon0(ymd)]}, ${d} de ${MONTHS[m - 1]}`;
}

function isActive(status: Booking["status"]) {
  return status === "PENDING" || status === "CONFIRMED";
}

function toneFor(booking: Booking) {
  if (booking.status === "PENDING") return "amber";
  if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") return "mute";
  let hash = 0;
  for (const ch of booking.id) hash = (hash + ch.charCodeAt(0)) % TONES.length;
  return TONES[hash];
}

export function BookingCalendar({
  settings,
  timezone,
}: {
  settings: BookingSettings;
  timezone: string;
}) {
  const today = todayInZone(timezone);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m };
  });
  const [selected, setSelected] = useState(today);
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<SlotPack | null>(null);

  const from = ymdParts(cursor.year, cursor.month, 1);
  const to = addDays(ymdParts(cursor.year, cursor.month, daysInMonth(cursor.year, cursor.month)), 1);
  const { data: items, reload } = useApiGet<Booking[]>(`/bookings?from=${from}T00:00:00.000Z&to=${to}T00:00:00.000Z`);
  const { data: services } = useApiGet<CatalogItem[]>("/services");
  const { data: products } = useApiGet<CatalogItem[]>("/products");

  const bookableServices = useMemo(() => {
    const all = (services ?? []).filter((s) => s.isActive);
    if (!settings.bookableServiceIds.length) return all;
    return all.filter((s) => settings.bookableServiceIds.includes(s.id));
  }, [services, settings]);
  const bookableProducts = useMemo(() => {
    const all = (products ?? []).filter((p) => p.isActive && !p.isAddon);
    if (!settings.bookableProductIds.length) return all;
    return all.filter((p) => settings.bookableProductIds.includes(p.id));
  }, [products, settings]);
  const serviceAddons = useMemo(
    () =>
      (products ?? []).filter((p) => p.isActive && p.isAddon && !!serviceId && p.parentServiceId === serviceId),
    [products, serviceId],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of items ?? []) {
      const key = dayInZone(booking.startsAt, timezone);
      const list = map.get(key) ?? [];
      list.push(booking);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }
    return map;
  }, [items, timezone]);

  const cells = monthGrid(cursor.year, cursor.month);
  const dayBookings = byDay.get(selected) ?? [];
  const cap = settings.maxPerDay || 8;
  const activeCount = dayBookings.filter((b) => isActive(b.status)).length;
  const weekday = WEEK_KEYS[weekdayMon0(selected)];
  const open = (settings.weeklyHours?.[weekday] ?? []).length > 0;
  const full = activeCount >= cap;
  const remaining = Math.max(0, cap - activeCount);

  useEffect(() => {
    setSlots(null);
    if (!open || full) return;
    api<SlotPack>(`/bookings/slots?date=${selected}`)
      .then(setSlots)
      .catch(() => setSlots({ date: selected, slots: [], booked: activeCount, maxPerDay: cap, remaining }));
  }, [selected, open, full, activeCount, remaining, cap]);

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    setCursor({ year, month });
    setSelected(ymdParts(year, month, 1));
  }

  function shiftDay(delta: number) {
    const next = addDays(selected, delta);
    setSelected(next);
    const [y, m] = next.split("-").map(Number);
    setCursor({ year: y, month: m });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const answers: Record<string, string> = {};
    for (const field of settings.customFields ?? []) {
      answers[field.key] = String(form.get(`field_${field.key}`) || "");
    }
    try {
      await api("/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.get("customerName"),
          paymentStatus: form.get("paymentStatus") || "PENDING",
          customerPhone: String(form.get("customerPhone") || "") || null,
          customerEmail: String(form.get("customerEmail") || "") || null,
          notes: String(form.get("notes") || "") || null,
          startsAt: String(form.get("startsAt")),
          serviceId: String(form.get("serviceId") || "") || null,
          productId: String(form.get("productId") || "") || null,
          answers,
          source: "PANEL",
        }),
      });
      e.currentTarget.reset();
      setServiceId("");
      reload();
      api<SlotPack>(`/bookings/slots?date=${selected}`).then(setSlots).catch(() => undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function setStatus(id: string, status: Booking["status"]) {
    await api(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    reload();
  }

  async function setPayment(id: string, paymentStatus: Booking["paymentStatus"]) {
    await api(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ paymentStatus }) });
    reload();
  }

  return (
    <div className="cal-layout">
      <section className="card cal-board">
        <header className="cal-toolbar">
          <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
            <Icon name="chevron-left" />
          </button>
          <div className="cal-month">
            <strong>
              {MONTHS[cursor.month - 1]} {cursor.year}
            </strong>
            <p>Hasta {cap} reservas por día</p>
          </div>
          <div className="cal-toolbar-right">
            <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
              <Icon name="chevron-right" />
            </button>
            <button
              type="button"
              className="cal-hoy"
              onClick={() => {
                const [y, m] = today.split("-").map(Number);
                setCursor({ year: y, month: m });
                setSelected(today);
              }}
            >
              Hoy
            </button>
            <span className="cal-mini-ico" aria-hidden>
              <Icon name="calendar" />
            </span>
          </div>
        </header>
        <div className="cal-week">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        {items === null ? (
          <LoadingState compact label="Cargando calendario…" />
        ) : (
          <div className="cal-grid">
            {cells.map((date, i) => {
              if (!date) return <div key={`pad-${i}`} className="cal-cell empty" aria-hidden />;
              const list = (byDay.get(date) ?? []).filter((b) => b.status !== "CANCELLED");
              const used = (byDay.get(date) ?? []).filter((b) => isActive(b.status)).length;
              const dayKey = WEEK_KEYS[weekdayMon0(date)];
              const closed = !(settings.weeklyHours?.[dayKey] ?? []).length;
              const isFull = used >= cap;
              const isToday = date === today;
              const isOn = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  className={`cal-cell${isOn ? " on" : ""}${isToday ? " today" : ""}${closed ? " closed" : ""}${isFull ? " full" : ""}`}
                  onClick={() => setSelected(date)}
                >
                  <span className="cal-cell-top">
                    <span className="cal-num">{Number(date.slice(8))}</span>
                    <span className="cal-cap">{`${used}/${cap}`}</span>
                  </span>
                  <span className="cal-pips">
                    {list.slice(0, 3).map((b) => (
                      <em key={b.id} className={`${toneFor(b)} pay-${(b.paymentStatus ?? "PENDING").toLowerCase()}`}>
                        {formatClock(b.startsAt, timezone)} {b.customerName.split(" ")[0]} {b.customerName.split(" ")[1] ?? ""}
                      </em>
                    ))}
                    {list.length > 3 ? <i>+{list.length - 3} más</i> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="card cal-day">
        <div className="cal-day-nav">
          <button type="button" className="cal-nav" onClick={() => shiftDay(-1)} aria-label="Día anterior">
            <Icon name="chevron-left" />
          </button>
          <strong>{prettyDay(selected)}</strong>
          <button type="button" className="cal-nav" onClick={() => shiftDay(1)} aria-label="Día siguiente">
            <Icon name="chevron-right" />
          </button>
        </div>
        <p className="cal-ocupa">
          <b>
            {activeCount} / {cap}
          </b>{" "}
          ocupados
        </p>
        {!open && <p className="muted">Este día no tiene horario de reservas.</p>}
        {open && full && <p className="cal-full-note">Día lleno. Sube el máximo en Personalizar o cancela una cita.</p>}

        {dayBookings.length === 0 && open && <p className="cal-empty">Sin citas en este día.</p>}
        {dayBookings.length > 0 && (
          <ul className="cal-appts">
            {dayBookings.map((b) => {
              const what = b.service?.name || b.product?.name;
              return (
                <li key={b.id} className={toneFor(b)}>
                  <span className="cal-dot" />
                  <div className="cal-appt-body">
                    <div className="cal-appt-top">
                      <strong>
                        {formatClock(b.startsAt, timezone)} – {formatClock(b.endsAt, timezone)}
                      </strong>
                      <div className="cal-badges">
                        <label className={`cal-status ${b.status.toLowerCase()}`}>
                          <span className="sr-only">Cita</span>
                          <select value={b.status} onChange={(e) => setStatus(b.id, e.target.value as Booking["status"])}>
                            {Object.entries(STATUS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={`cal-pay ${(b.paymentStatus ?? "PENDING").toLowerCase()}`}>
                          <span className="sr-only">Pago</span>
                          <select
                            value={b.paymentStatus ?? "PENDING"}
                            onChange={(e) => setPayment(b.id, e.target.value as Booking["paymentStatus"])}
                          >
                            {Object.entries(PAYMENT).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <p>
                      {b.customerName}
                      {what ? ` · ${what}` : ""}
                    </p>
                    {b.customerPhone ? (
                      <small>
                        <Icon name="phone" /> {b.customerPhone}
                      </small>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {open && !full && (
          <form className="cal-form" onSubmit={onSubmit}>
            <h3>Agendar</h3>
            <p className="muted">Quedan {remaining} cupos este día.</p>
            <label className="cal-field">
              <span>Hora</span>
              <span className="cal-input">
                <Icon name="clock" />
                <select name="startsAt" required>
                  <option value="">{slots?.slots.length ? "Elegir horario…" : "Sin huecos libres"}</option>
                  {(slots?.slots ?? []).map((slot) => (
                    <option key={slot.start} value={slot.start}>
                      {formatClock(slot.start, timezone)} – {formatClock(slot.end, timezone)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            {(settings.mode === "SERVICES" || settings.mode === "BOTH") && (
              <label className="cal-field">
                <span>Servicio</span>
                <span className="cal-input">
                  <Icon name="spark" />
                  <select
                    name="serviceId"
                    required={settings.mode === "SERVICES"}
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  >
                    <option value="">Elegir servicio…</option>
                    {bookableServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            )}
            {(settings.mode === "PRODUCTS" || settings.mode === "BOTH") && (
              <label className="cal-field">
                <span>Producto</span>
                <span className="cal-input">
                  <Icon name="box" />
                  <select name="productId" required={settings.mode === "PRODUCTS"}>
                    <option value="">Elegir producto…</option>
                    {bookableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            )}
            {settings.mode === "SERVICES" && serviceAddons.length > 0 && (
              <label className="cal-field">
                <span>Implemento</span>
                <span className="cal-input">
                  <Icon name="box" />
                  <select name="productId">
                    <option value="">Sin implemento</option>
                    {serviceAddons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.stock != null ? ` · ${p.stock} disp.` : ""}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            )}
            <label className="cal-field">
              <span>Cliente</span>
              <span className="cal-input">
                <Icon name="user" />
                <input name="customerName" required placeholder="Buscar cliente…" />
              </span>
            </label>
            <label className="cal-field">
              <span>Pago</span>
              <select name="paymentStatus" defaultValue="PENDING">
                <option value="PENDING">Pendiente</option>
                <option value="DEPOSIT">Abonado</option>
                <option value="PAID">Pagado</option>
              </select>
            </label>
            <label className="cal-field">
              <span>Teléfono</span>
              <span className="cal-input">
                <Icon name="phone" />
                <input name="customerPhone" required={settings.requirePhone} placeholder="999 000 111" />
              </span>
            </label>
            {settings.requireEmail ? (
              <label className="cal-field">
                <span>Correo</span>
                <input name="customerEmail" type="email" required />
              </label>
            ) : (
              <input type="hidden" name="customerEmail" />
            )}
            {(settings.customFields ?? []).map((field) => (
              <label className="cal-field" key={field.key}>
                <span>{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea name={`field_${field.key}`} rows={2} required={field.required} />
                ) : field.type === "select" ? (
                  <select name={`field_${field.key}`} required={field.required}>
                    <option value="">Elegir…</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={`field_${field.key}`}
                    type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                    required={field.required}
                  />
                )}
              </label>
            ))}
            {error && <p className="error">{error}</p>}
            <button className="btn cal-add" disabled={!slots?.slots.length}>
              <Icon name="plus" />
              Agregar reserva
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
