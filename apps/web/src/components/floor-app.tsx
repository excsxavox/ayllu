"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BOOKING_PLACES, filterCabanaPlaces, placeTracksGuests, type BookingPlace } from "@aylluu/shared";
import { FloorWhatsApp, countFloorHandoffs } from "@/components/floor-whatsapp";
import { api, type Company } from "@/lib/api";
import { dropOccupy, enqueueFloorOp, flushFloorQueue, isNetworkError, isOnline, pendingFloorOps } from "@/lib/floor-offline";
import { writeCache } from "@/lib/query-cache";
import { useApiGet } from "@/lib/use-api-get";
import { Icon } from "@/components/icons";
import { LoadingState } from "@/components/loading-state";
import { PlacesEditor } from "@/components/places-editor";
import "./floor.css";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
type Pay = "PENDING" | "DEPOSIT" | "PAID";
type View = "inicio" | "mapa" | "agenda" | "rapida" | "lugares" | "cerrados" | "mas" | "whatsapp";

type Booking = {
  id: string;
  customerName: string;
  customerPhone: string;
  notes?: string | null;
  answers?: Record<string, string | number | boolean>;
  startsAt: string;
  endsAt: string;
  status: Status;
  paymentStatus: Pay;
  source?: "PANEL" | "BOT" | "MANUAL";
  service?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
};

type FloorDay = {
  date: string;
  timezone: string;
  companyName: string;
  bookings: Booking[];
  slots: Array<{ start: string; end: string }>;
  booked: number;
  maxPerDay: number;
  remaining: number;
  places?: BookingPlace[];
};

type Settings = {
  mode: "SERVICES" | "PRODUCTS" | "BOTH";
  requirePhone: boolean;
  requireEmail: boolean;
  bookableServiceIds: string[];
  bookableProductIds: string[];
  places?: BookingPlace[];
  closedDates?: string[];
};

type CatalogItem = { id: string; name: string; durationMinutes?: number | null; isActive: boolean; isAddon?: boolean };

type UnitSpot = { id: string; n: number; x: number; y: number };

function layoutUnits(count: number): UnitSpot[] {
  const cols = count <= 6 ? Math.min(count, 3) : count <= 12 ? 4 : count <= 20 ? 5 : 6;
  const rows = Math.max(1, Math.ceil(count / cols));
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: String(i + 1),
      n: i + 1,
      x: 12 + ((col + 0.5) / cols) * 76,
      y: 16 + ((row + 0.5) / rows) * 68,
    };
  });
}

function placeKeys(place: BookingPlace) {
  return [place.id, ...place.name.toLowerCase().split(/[^a-záéíóúñ0-9]+/i).filter((w) => w.length > 2)];
}

const STATUS: Record<Status, string> = {
  PENDING: "Por confirmar",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Atendida",
  NO_SHOW: "No llegó",
};

const PAY: Record<Pay, string> = {
  PENDING: "Sin pagar",
  DEPOSIT: "Seña",
  PAID: "Pagado",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function todayInZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-EC", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
function longDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
}
function weekdayShort(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
}
function startOfWeek(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(ymd, -dow);
}
function monthLabel(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  const name = new Intl.DateTimeFormat("es-EC", { month: "long" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}
function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function unitFromNotes(notes?: string | null) {
  return notes?.match(/\[u:[a-z0-9_]+:(\d+)\]/i)?.[1] ?? "";
}
function guestCount(b: Booking) {
  const raw = b.answers?.guests ?? b.answers?.personas;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function agendaStatus(b: Booking, today: string, timeZone: string) {
  if (b.status === "PENDING") return { key: "pendiente", label: "Pendiente" };
  if (b.status === "CONFIRMED" && dayKey(b.startsAt, timeZone) === today) return { key: "en_curso", label: "En curso" };
  if (b.status === "CONFIRMED") return { key: "confirmada", label: "Confirmada" };
  return { key: badgeClass(b.status), label: STATUS[b.status] };
}
function live(status: Status): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}
function what(b: Booking) {
  return b.service?.name || b.product?.name || "Reserva";
}
function haystack(b: Booking) {
  return `${b.service?.name ?? ""} ${b.product?.name ?? ""} ${b.notes ?? ""}`.toLowerCase();
}
function placeOf(b: Booking, places: BookingPlace[]): BookingPlace {
  const tagged = (b.notes ?? "").match(/\[u:([a-z0-9_]+):\d+\]/i);
  if (tagged) {
    const found = places.find((p) => p.id === tagged[1]);
    if (found) return found;
  }
  const text = haystack(b);
  return places.find((p) => placeKeys(p).some((k) => text.includes(k))) ?? places[0] ?? DEFAULT_BOOKING_PLACES[0];
}
function pinTone(bookings: Booking[]) {
  if (bookings.some((b) => b.status === "CONFIRMED")) return "occupied";
  if (bookings.some((b) => b.status === "PENDING")) return "reserved";
  return "free";
}
function unitTag(placeId: string, unitId: string) {
  return `[u:${placeId}:${unitId}]`;
}
function bookingForUnit(bookings: Booking[], placeId: string, unitId: string) {
  const tag = unitTag(placeId, unitId);
  return bookings.find((b) => live(b.status) && (b.notes ?? "").includes(tag)) ?? null;
}
function zoneUnitLine(place: BookingPlace, bookings: Booking[]) {
  const spots = layoutUnits(place.unitCount);
  const taken = spots.filter((u) => bookingForUnit(bookings, place.id, u.id)).length;
  const reserved = spots.filter((u) => bookingForUnit(bookings, place.id, u.id)?.status === "PENDING").length;
  const occupied = taken - reserved;
  if (!taken) return `${spots.length} libres`;
  return `${spots.length} · ${spots.length - taken} libres · ${occupied + reserved} ocupadas`;
}
function badgeClass(status: Status) {
  if (status === "CONFIRMED") return "confirmada";
  if (status === "PENDING") return "pendiente";
  if (status === "CANCELLED" || status === "NO_SHOW") return "cancelada";
  return "completada";
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "equipo";
}
function unitCode(place: BookingPlace, n: number) {
  const letter =
    place.id === "botes" ? "B" : place.id === "glamping" ? "G" : place.id === "restaurante" ? "M" : place.id.slice(0, 1).toUpperCase();
  return `${letter}${String(n).padStart(2, "0")}`;
}
function occupancyLine(place: BookingPlace, bookings: Booking[]) {
  const spots = layoutUnits(place.unitCount);
  const taken = spots.filter((u) => bookingForUnit(bookings, place.id, u.id)).length;
  return { taken, total: spots.length, free: spots.length - taken };
}

function rapidaTabLabel(place: BookingPlace) {
  if (place.id === "botes") return "Botes";
  if (place.id === "restaurante") return "Mesas";
  return place.name;
}

function newOfflineId() {
  return `off_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function UnitBoard({
  place,
  bookings,
  picked,
  busy,
  onToggle,
}: {
  place: BookingPlace;
  bookings: Booking[];
  picked: string[];
  busy: boolean;
  onToggle: (unit: UnitSpot, current: Booking | null) => void;
}) {
  const spots = layoutUnits(place.unitCount);
  const cols = place.unitCount <= 6 ? Math.min(place.unitCount, 3) : place.unitCount <= 12 ? 4 : place.unitCount <= 20 ? 5 : 6;
  const rows = Math.max(1, Math.ceil(place.unitCount / cols));
  return (
    <div
      className={`unit-board is-${place.id}`}
      role="group"
      aria-label={`Sitios de ${place.name}`}
      style={{ ["--unit-rows" as string]: String(rows) }}
    >
      {spots.map((unit) => {
        const current = bookingForUnit(bookings, place.id, unit.id);
        const tone = current ? (current.status === "PENDING" ? "reserved" : "occupied") : "free";
        const chosen = !current && picked.includes(unit.id);
        return (
          <button
            key={unit.id}
            type="button"
            className={`unit-spot ${tone}${chosen ? " picked" : ""}`}
            style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
            disabled={busy}
            aria-pressed={Boolean(current) || chosen}
            aria-label={`${unit.n}, ${current ? "ocupado" : chosen ? "elegido" : "libre"}`}
            onClick={() => onToggle(unit, current)}
          >
            {unit.n}
          </button>
        );
      })}
    </div>
  );
}

export function FloorApp({
  company,
  companies,
  name,
  onCompanyChange,
  onExit,
  onLogout,
}: {
  company?: Company;
  companies: Company[];
  name: string;
  onCompanyChange: (id: string) => void;
  onExit: () => void;
  onLogout: () => void;
}) {
  const timezone = company?.timezone || "America/Guayaquil";
  const today = todayInZone(timezone);
  const [view, setView] = useState<View>("inicio");
  const [waJump, setWaJump] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [date, setDate] = useState(today);
  const [zone, setZone] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [draftPlaces, setDraftPlaces] = useState<BookingPlace[]>(DEFAULT_BOOKING_PLACES);
  const [draftClosed, setDraftClosed] = useState<string[]>([]);
  const [closedMonth, setClosedMonth] = useState(today.slice(0, 7));
  const [openId, setOpenId] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ booking: Booking; place: BookingPlace; unit: UnitSpot } | null>(null);
  const [placesReturn, setPlacesReturn] = useState<View>("rapida");
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"todas" | "pendiente" | "confirmada" | "en_curso">("todas");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; sx: number; sy: number; x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(date);
  const { data, setData, reload } = useApiGet<FloorDay>(`/bookings/floor?date=${date}`);
  const { data: weekRows } = useApiGet<Booking[]>(`/bookings?from=${weekStart}&to=${addDays(weekStart, 7)}`);
  const { data: settings, setData: setSettings, reload: reloadSettings } = useApiGet<Settings>("/bookings/settings");
  const { data: services } = useApiGet<CatalogItem[]>("/services");
  const { data: products } = useApiGet<CatalogItem[]>("/products");
  const { data: waAlerts } = useApiGet<Array<{ id: string; type: string; conversationId?: string | null; readAt?: string | null }>>(
    "/alerts?unread=1",
  );
  const { data: waConversations } = useApiGet<Array<{ id: string; humanTakeover: boolean; status: string }>>("/conversations");

  const bookings = data?.bookings ?? [];
  const rawPlaces = data?.places?.length ? data.places : settings?.places?.length ? settings.places : DEFAULT_BOOKING_PLACES;
  const places = filterCabanaPlaces(rawPlaces);
  const waPending = countFloorHandoffs(waAlerts, waConversations);
  const byZone = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const place of places) map.set(place.id, []);
    for (const b of bookings) map.get(placeOf(b, places).id)?.push(b);
    return map;
  }, [bookings, places]);

  const selected = places.find((z) => z.id === zone) ?? null;
  const fallbackPlace = selected ?? places[0] ?? DEFAULT_BOOKING_PLACES[0];
  const floorPath = `/bookings/floor?date=${date}`;

  function rememberFloor(next: FloorDay) {
    setData(next);
    writeCache(floorPath, next);
  }

  useEffect(() => {
    setPicked([]);
  }, [zone]);

  useEffect(() => {
    const syncOnline = () => setOnline(isOnline());
    syncOnline();
    setQueued(pendingFloorOps());
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    void flushFloorQueue()
      .then(async (ok) => {
        setQueued(pendingFloorOps());
        if (ok) {
          await Promise.all([reload(), reloadSettings()]);
        }
      })
      .catch(() => setQueued(pendingFloorOps()));
  }, [online, date, reload, reloadSettings]);

  useEffect(() => {
    if (zoom > 1) frameRef.current?.scrollTo({ top: 0 });
  }, [zoom]);

  const bookableServices = (services ?? []).filter(
    (s) => s.isActive && (!settings?.bookableServiceIds.length || settings.bookableServiceIds.includes(s.id)),
  );
  const bookableProducts = (products ?? []).filter(
    (p) =>
      p.isActive &&
      !p.isAddon &&
      (!settings?.bookableProductIds.length || settings.bookableProductIds.includes(p.id)),
  );

  function catalogForPlace(place: BookingPlace) {
    const keys = placeKeys(place);
    return bookableServices.find((s) => keys.some((k) => s.name.toLowerCase().includes(k)))
      ?? bookableProducts.find((p) => keys.some((k) => p.name.toLowerCase().includes(k)));
  }

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 3200);
  }

  function clampPan(nextZoom: number, x: number, y: number) {
    const max = Math.max(0, (nextZoom - 1) / 2);
    return { x: Math.max(-max, Math.min(max, x)), y: Math.max(-max, Math.min(max, y)) };
  }

  function focusZone(id: string) {
    const z = places.find((item) => item.id === id);
    if (!z) return;
    const nextZoom = 2.3;
    setZone(id);
    setZoom(nextZoom);
    setPan(clampPan(nextZoom, (0.5 - (z.x ?? 50) / 100) * nextZoom, (0.5 - (z.y ?? 50) / 100) * nextZoom));
    setView("mapa");
  }

  function resetMap() {
    setZone(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    frameRef.current?.scrollTo({ top: 0 });
  }

  function changeZoom(next: number) {
    const zoomTo = Math.max(1, Math.min(4, next));
    const scale = zoom === 0 ? 1 : zoomTo / zoom;
    setZoom(zoomTo);
    setPan(zoomTo <= 1 ? { x: 0, y: 0 } : clampPan(zoomTo, pan.x * scale, pan.y * scale));
    if (zoomTo <= 1) frameRef.current?.scrollTo({ top: 0 });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (zoom <= 1 || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: pan.x, y: pan.y };
    e.currentTarget.classList.add("panning");
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPan(clampPan(zoom, drag.current.x + (e.clientX - drag.current.sx) / rect.width, drag.current.y + (e.clientY - drag.current.sy) / rect.height));
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    e.currentTarget.classList.remove("panning");
  }

  function applyLocalPatch(id: string, body: Partial<Pick<Booking, "status" | "paymentStatus">>) {
    if (!data) return;
    rememberFloor({
      ...data,
      bookings: data.bookings.map((b) => (b.id === id ? { ...b, ...body } : b)),
    });
  }

  async function patch(id: string, body: Partial<Pick<Booking, "status" | "paymentStatus">>, label: string) {
    setBusy(true);
    setError("");
    applyLocalPatch(id, body);
    if (id.startsWith("off_") && body.status === "COMPLETED") {
      dropOccupy(id);
      setQueued(pendingFloorOps());
      flash(label);
      setBusy(false);
      return;
    }
    try {
      if (!isOnline()) throw new Error("offline");
      await api(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await reload();
      flash(label);
    } catch (err) {
      if (!isOnline() || isNetworkError(err)) {
        enqueueFloorOp({ id: newOfflineId(), type: "patch", bookingId: id, body });
        setQueued(pendingFloorOps());
        flash(`${label} · se enviará al tener internet`);
      } else {
        setError((err as Error).message);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  function occupyStart() {
    if (data?.slots[0]?.start) return data.slots[0].start;
    return new Date(`${date}T10:00:00-05:00`).toISOString();
  }

  function openClosedDays() {
    setDraftClosed([...(settings?.closedDates ?? [])].sort());
    setClosedMonth(today.slice(0, 7));
    setView("cerrados");
  }

  function toggleClosedDay(ymd: string) {
    if (ymd < today) return;
    setDraftClosed((prev) =>
      prev.includes(ymd) ? prev.filter((d) => d !== ymd).sort() : [...prev, ymd].sort(),
    );
  }

  async function saveClosedDays() {
    setBusy(true);
    setError("");
    const nextDates = [...draftClosed].sort();
    if (settings) {
      const next = { ...settings, closedDates: nextDates };
      setSettings(next);
      writeCache("/bookings/settings", next);
    }
    try {
      if (!isOnline()) throw new Error("offline");
      await api("/bookings/settings", {
        method: "PATCH",
        body: JSON.stringify({ closedDates: nextDates }),
      });
      await reloadSettings();
      flash(nextDates.length ? `${nextDates.length} día${nextDates.length === 1 ? "" : "s"} cerrado${nextDates.length === 1 ? "" : "s"}` : "Sin días cerrados");
      setView("mas");
    } catch (err) {
      if (!isOnline() || isNetworkError(err)) {
        enqueueFloorOp({ id: newOfflineId(), type: "settings", closedDates: nextDates });
        setQueued(pendingFloorOps());
        flash("Guardado · se enviará al tener internet");
        setView("mas");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  function closedMonthDays(month: string) {
    const [y, m] = month.split("-").map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // lunes=0
    return { days, offset, title: monthLabel(`${month}-01`) };
  }

  function onSpot(unit: UnitSpot, current: Booking | null, place = fallbackPlace, immediate = false) {
    if (current) {
      void patch(current.id, { status: "COMPLETED" }, `${place.name} ${unit.n} libre`);
      return;
    }
    if (immediate) {
      void occupyUnits(place, [unit]);
      return;
    }
    setPicked((prev) => (prev.includes(unit.id) ? prev.filter((id) => id !== unit.id) : [...prev, unit.id]));
  }

  async function occupyPicked(place = fallbackPlace) {
    const units = layoutUnits(place.unitCount).filter((unit) => picked.includes(unit.id));
    await occupyUnits(place, units);
  }

  function occupyBody(place: BookingPlace, unit: UnitSpot, startsAt: string, service: CatalogItem | undefined) {
    return {
      customerName: `${unitCode(place, unit.n)}`,
      customerPhone: settings?.requirePhone ? "0990000000" : null,
      customerEmail: null,
      notes: `${place.name} ${unitCode(place, unit.n)} · ${unitTag(place.id, unit.id)}`,
      answers: { guests },
      startsAt,
      serviceId: service && "durationMinutes" in service ? service.id : bookableServices[0]?.id ?? null,
      productId: service && "durationMinutes" in service ? null : bookableProducts[0]?.id ?? null,
      paymentStatus: "PENDING",
      source: "MANUAL",
    };
  }

  function localBooking(place: BookingPlace, unit: UnitSpot, startsAt: string, id: string): Booking {
    return {
      id,
      customerName: unitCode(place, unit.n),
      customerPhone: "",
      notes: `${place.name} ${unitCode(place, unit.n)} · ${unitTag(place.id, unit.id)}`,
      answers: { guests },
      startsAt,
      endsAt: startsAt,
      status: "CONFIRMED",
      paymentStatus: "PENDING",
      source: "MANUAL",
    };
  }

  async function occupyUnits(place: BookingPlace, units: UnitSpot[]) {
    if (!units.length) return;
    const service = catalogForPlace(place);
    if (!service && !bookableProducts[0] && !bookableServices[0]) {
      setError("No hay un servicio para anotar este lugar");
      return;
    }
    setBusy(true);
    setError("");
    const startsAt = occupyStart();
    try {
      if (!isOnline()) throw new Error("offline");
      for (const unit of units) {
        await api("/bookings", { method: "POST", body: JSON.stringify(occupyBody(place, unit, startsAt, service)) });
      }
      setPicked([]);
      await reload();
      flash(units.length === 1 ? `${unitCode(place, units[0].n)} ocupado` : `${units.length} ocupados en ${place.name}`);
    } catch (err) {
      if (!isOnline() || isNetworkError(err)) {
        if (data) {
          const extras = units.map((unit) => {
            const tempId = newOfflineId();
            enqueueFloorOp({ id: tempId, type: "occupy", tempId, body: occupyBody(place, unit, startsAt, service) });
            return localBooking(place, unit, startsAt, tempId);
          });
          rememberFloor({
            ...data,
            bookings: [...data.bookings, ...extras],
            booked: data.booked + extras.length,
          });
        }
        setPicked([]);
        setQueued(pendingFloorOps());
        flash("Anotado sin internet · se actualizará al conectar");
      } else {
        setError((err as Error).message);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  function openPlaces(back: View = "rapida") {
    setDraftPlaces(places);
    setPlacesReturn(back);
    setView("lugares");
  }

  async function savePlaces() {
    setBusy(true);
    setError("");
    if (data) rememberFloor({ ...data, places: draftPlaces });
    if (settings) {
      const next = { ...settings, places: draftPlaces };
      setSettings(next);
      writeCache("/bookings/settings", next);
    }
    try {
      if (!isOnline()) throw new Error("offline");
      await api("/bookings/settings", {
        method: "PATCH",
        body: JSON.stringify({ places: draftPlaces }),
      });
      await Promise.all([reload(), reloadSettings()]);
      flash("Lugares guardados");
      setView(placesReturn);
    } catch (err) {
      if (!isOnline() || isNetworkError(err)) {
        enqueueFloorOp({ id: newOfflineId(), type: "settings", places: draftPlaces });
        setQueued(pendingFloorOps());
        flash("Guardado en el teléfono · se enviará al tener internet");
        setView(placesReturn);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!company?.bookingsEnabled) {
    return (
      <div className="ayllu-m">
        <header className="app-header">
          <span className="brand"><span className="brand-symbol"><img src="/ayllu-icon.svg" alt="" /></span><span>AYLLU<small>GESTIÓN INTERNA</small></span></span>
        </header>
        <main>
          <div className="empty-state">
            <h3>Reservas aún no activas</h3>
            <p>Un administrador debe activar el módulo de reservas para esta empresa.</p>
            <button type="button" className="btn" onClick={onExit}>Volver al panel</button>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ayllu-m">
        <LoadingState label="Cargando el mapa…" />
      </div>
    );
  }

  const pending = bookings.filter((b) => b.status === "PENDING").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const weekBookings = weekRows ?? [];
  const bookedDays = new Set(weekBookings.filter((b) => live(b.status)).map((b) => dayKey(b.startsAt, timezone)));
  const dayBookings = weekBookings.filter((b) => dayKey(b.startsAt, timezone) === date);
  const shown = dayBookings.filter((b) => {
    const st = agendaStatus(b, today, timezone).key;
    return filter === "todas" || st === filter;
  });
  const people = shown.filter((b) => live(b.status)).reduce((n, b) => n + guestCount(b), 0);

  return (
    <div className={`ayllu-m${view === "mapa" ? " is-map" : ""}${view === "rapida" || view === "lugares" ? " is-rapida" : ""}${view === "inicio" ? " is-home" : ""}`} translate="no">
      <header className="app-header">
        {view === "rapida" || view === "lugares" || view === "cerrados" ? (
          <>
            <button
              type="button"
              className="header-gear"
              onClick={() => setView(view === "lugares" ? placesReturn : view === "cerrados" ? "mas" : "inicio")}
              aria-label="Volver"
            >
              <Icon name="chevron-left" />
            </button>
            <p className="header-title">
              {view === "lugares" ? "Productos" : view === "cerrados" ? "Días cerrados" : "Reserva rápida"}
            </p>
            <span />
          </>
        ) : view === "mapa" ? (
          <>
            <button type="button" className="wordmark" onClick={() => setView("inicio")}>AYLLU</button>
            <p className="header-title">Mapa del lago</p>
            <div className="header-actions">
              <label className="demo-tag date-selector">
                <span>{date === today ? "Hoy" : date.slice(8)}</span>
                <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setOpenId(null); }} />
              </label>
              <button type="button" className="avatar" onClick={onLogout} aria-label="Cerrar sesión">
                {initials(name || "AY")}
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="wordmark" onClick={() => setView("inicio")}>AYLLU</button>
            <div className="header-actions">
              <button type="button" className="header-gear" onClick={() => setView("agenda")} aria-label="Pendientes">
                <Icon name="bell" />
              </button>
              <button type="button" className="avatar" onClick={() => setView("mas")} aria-label="Más">
                {initials(name || "AY")}
              </button>
            </div>
          </>
        )}
      </header>

      <main>
        {view === "lugares" ? (
          <div className="page-heading">
            <div>
              <p className="eyebrow">OCUPACIÓN DEL COMPLEJO</p>
              <h1>Lugares</h1>
              <p className="heading-subtitle">{longDate(date)}</p>
            </div>
          </div>
        ) : null}

        {error && view !== "mapa" && view !== "inicio" ? <p className="form-error">{error}</p> : null}

        {view === "inicio" ? (
          <section className="home-screen">
            <div className="hello-block">
              <div>
                <h1>Buen día, {firstName(name)}</h1>
                <p>Listos para un gran día en el lago</p>
              </div>
              <label className="home-today">
                <span>{date === today ? "Hoy" : date.slice(8)}</span>
                <Icon name="chevron-down" />
                <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setOpenId(null); }} />
              </label>
            </div>
            <button type="button" className="btn full home-cta" onClick={() => setView("rapida")}>
              <Icon name="plus" /> Reserva rápida
            </button>
            <div className="stat-pair">
              <article>
                <Icon name="calendar" />
                <b>{data.booked}</b>
                <span>Reservas de hoy</span>
              </article>
              <article>
                <Icon name="user" />
                <b>{pending}</b>
                <span>Llegadas pendientes</span>
              </article>
            </div>
            <h2 className="home-section">Estado del lugar</h2>
            <div className="place-status-list">
              {(["glamping", "botes", "restaurante"]
                .map((id) => places.find((p) => p.id === id))
                .filter((p): p is BookingPlace => Boolean(p))
                .concat(places.filter((p) => !["glamping", "botes", "restaurante"].includes(p.id)))
                .slice(0, 3)).map((place) => {
                const occ = occupancyLine(place, byZone.get(place.id) ?? []);
                const label = place.id === "botes" ? "Botes" : place.id === "restaurante" ? "Restaurante" : place.name;
                return (
                  <button key={place.id} type="button" className="place-status" onClick={() => { setZone(place.id); setView("rapida"); }}>
                    <Icon name={place.icon ?? "map"} />
                    <strong>{label}</strong>
                    <small>{occ.free} de {occ.total} libres</small>
                    <Icon name="chevron-right" />
                  </button>
                );
              })}
            </div>
            <div className="home-section-row">
              <h2 className="home-section">Por llegar</h2>
              <button type="button" className="home-link" onClick={() => setView("agenda")}>Ver todas</button>
            </div>
            <div className="home-arrivals">
              {bookings.filter((b) => live(b.status)).slice(0, 3).length === 0 ? (
                <p className="heading-subtitle">Nadie en camino por ahora.</p>
              ) : bookings.filter((b) => live(b.status)).slice(0, 3).map((b) => {
                const place = placeOf(b, places);
                const unit = unitFromNotes(b.notes);
                const st = agendaStatus(b, today, timezone);
                return (
                  <button key={b.id} type="button" className="home-arrival" onClick={() => focusZone(place.id)}>
                    <span>
                      <strong>{b.customerName}</strong>
                      <small>{place.id === "botes" ? "Botes" : place.name}{unit ? ` ${unitCode(place, Number(unit) || 0)}` : ""} · {clock(b.startsAt, timezone)}</small>
                    </span>
                    <em className={`badge ${st.key}`}>{st.label === "Pendiente" ? "Reservado" : st.label}</em>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {view === "mapa" ? (
          <section className="map-stage">
            <div
              ref={frameRef}
              className={`map-frame${zoom > 1 ? " zoomed" : ""}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="map-world"
                style={{
                  transform: `translate(${pan.x * 100}%, ${pan.y * 100}%) scale(${zoom})`,
                  ["--pin-scale" as string]: String(1 / zoom),
                }}
              >
                <img src="/lago-ilustrativo.png" width={1254} height={1254} alt="Vista aérea ilustrativa del lago con glampings, restaurante, muelle, pesca, senderos, juegos y parqueadero" draggable={false} />
                {places.map((z) => {
                  const list = (byZone.get(z.id) ?? []).filter((b) => live(b.status));
                  const tone = pinTone(list);
                  return (
                    <button
                      key={z.id}
                      type="button"
                      className={`dot-pin ${tone}${zone === z.id ? " selected" : ""}`}
                      style={{ left: `${z.x ?? 50}%`, top: `${z.y ?? 50}%` }}
                      aria-label={z.name}
                      onClick={() => (zone === z.id ? resetMap() : focusZone(z.id))}
                    >
                      {places.indexOf(z) + 1}
                      <i />
                    </button>
                  );
                })}
              </div>
              <div className="map-zoom-controls">
                <button type="button" aria-label="Acercar" disabled={zoom >= 4} onClick={() => changeZoom(zoom + 0.5)}>
                  <Icon name="plus" />
                </button>
                <button type="button" aria-label="Alejar" disabled={zoom <= 1} onClick={() => changeZoom(zoom - 0.5)}>
                  <Icon name="minus" />
                </button>
              </div>
              {error ? <p className="map-error">{error}</p> : null}
            </div>

            <aside className="map-dock open">
              <div className="dock-zone">
                <span className="dock-icon"><Icon name={selected?.icon ?? "map"} /></span>
                <span>
                  <strong>{selected?.name ?? "Toca un punto"}</strong>
                  <small>{selected ? zoneUnitLine(selected, byZone.get(selected.id) ?? []) : "Elige un lugar y marca los números"}</small>
                </span>
              </div>
              {selected ? (
                <UnitBoard
                  place={selected}
                  bookings={byZone.get(selected.id) ?? []}
                  picked={picked}
                  busy={busy}
                  onToggle={(unit, current) => onSpot(unit, current, selected)}
                />
              ) : null}
              {selected && picked.length ? (
                <button type="button" className="btn full" disabled={busy} onClick={() => occupyPicked(selected)}>
                  {busy ? "Ocupando…" : `Ocupar ${picked.length}`}
                </button>
              ) : null}
              <div className="map-legend">
                <span className="field-status free"><i />Libre</span>
                <span className="field-status occupied"><i />Ocupado</span>
                <span className="field-status reserved"><i />Reservado</span>
              </div>
            </aside>
          </section>
        ) : null}

        {view === "agenda" ? (
          <>
            <div className="page-heading">
              <h1>Reservas</h1>
              <button type="button" className="btn" onClick={() => setView("rapida")}>
                <Icon name="plus" /> Nueva
              </button>
            </div>
            <div className="month-bar">
              <label className="month-picker">
                <span>{monthLabel(date)}</span>
                <input
                  type="month"
                  value={date.slice(0, 7)}
                  onChange={(e) => {
                    const next = `${e.target.value}-01`;
                    setDate(next > today ? today : next);
                    setOpenId(null);
                  }}
                />
              </label>
              <button type="button" className="today-btn" onClick={() => setDate(today)}>
                <Icon name="calendar" /> Hoy
              </button>
            </div>
            <div className="week-strip" role="tablist" aria-label="Días de la semana">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(weekStart, i);
                return (
                  <button
                    key={day}
                    type="button"
                    className={`week-day${day === date ? " active" : ""}${bookedDays.has(day) ? " has-bookings" : ""}`}
                    onClick={() => { setDate(day); setOpenId(null); }}
                  >
                    <span>{weekdayShort(day)}</span>
                    <strong>{Number(day.slice(8))}</strong>
                    <i />
                  </button>
                );
              })}
            </div>
            <div className="filter-row" role="group" aria-label="Filtrar reservas">
              {([
                ["todas", "Todas"],
                ["pendiente", "Pendientes"],
                ["confirmada", "Confirmadas"],
                ["en_curso", "En curso"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`filter-pill${filter === key ? " active" : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="summary-line">
              <b>{shown.length} {shown.length === 1 ? "reserva" : "reservas"}</b>
              <span>·</span>
              {people} {people === 1 ? "persona" : "personas"}
            </p>
            <div className="reservation-list">
              {shown.length === 0 ? (
                <div className="empty-state">
                  <h3>Sin reservas en esta vista</h3>
                  <p>Elige otro día o cambia el filtro. También puedes anotar desde el mapa.</p>
                </div>
              ) : shown.map((b) => {
                const place = placeOf(b, places);
                const unit = unitFromNotes(b.notes);
                const st = agendaStatus(b, today, timezone);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="reservation-card"
                    onClick={() => { setOpenId(b.id); focusZone(place.id); }}
                  >
                    <span className="service-icon"><Icon name={place.icon ?? "calendar"} /></span>
                    <div>
                      <h3>{b.customerName}</h3>
                      <p>{place.name}{unit ? ` ${unit}` : ""} · {guestCount(b)} {guestCount(b) === 1 ? "persona" : "personas"}</p>
                    </div>
                    <div className="reservation-end">
                      <div className="trailing">
                        {clock(b.startsAt, timezone)}
                        <small className={`badge ${st.key}`}>{st.label}</small>
                      </div>
                      <Icon name="chevron-right" />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {view === "rapida" ? (
          <div className="rapida-screen">
            <p className="rapida-lead">Selecciona un lugar libre</p>
            <div className="rapida-tabs" role="tablist" aria-label="Productos">
              {places.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  role="tab"
                  aria-selected={fallbackPlace.id === place.id}
                  className={fallbackPlace.id === place.id ? "active" : ""}
                  onClick={() => setZone(place.id)}
                >
                  <Icon name={place.icon ?? "map"} />
                  {rapidaTabLabel(place)}
                </button>
              ))}
              <button
                type="button"
                className="rapida-config"
                onClick={() => openPlaces("rapida")}
              >
                <Icon name="plus" />
                Añadir
              </button>
            </div>
            <div className="rapida-when">
              <label>
                <Icon name="calendar" />
                <span>{date === today ? "Hoy" : date.slice(8)}</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <div>
                <Icon name="clock" />
                <span>{data.slots[0] ? `${clock(data.slots[0].start, timezone)}–${clock(data.slots[0].end, timezone)}` : "11:00–12:00"}</span>
              </div>
            </div>
            <div className="rapida-people">
              <span>Personas</span>
              <span className="guest-stepper">
                <button type="button" aria-label="Menos" onClick={() => setGuests((n) => Math.max(1, n - 1))}>−</button>
                <b>{guests}</b>
                <button type="button" aria-label="Más" onClick={() => setGuests((n) => Math.min(12, n + 1))}>+</button>
              </span>
            </div>
            <h2 className="rapida-list-title">{rapidaTabLabel(fallbackPlace)} disponibles</h2>
            <div className="quick-resource-grid">
              {layoutUnits(fallbackPlace.unitCount).map((unit) => {
                const current = bookingForUnit(byZone.get(fallbackPlace.id) ?? [], fallbackPlace.id, unit.id);
                const tone = current ? (current.status === "PENDING" ? "reserved" : "occupied") : "free";
                const code = unitCode(fallbackPlace, unit.n);
                const people = current ? guestCount(current) : 0;
                const status = current
                  ? placeTracksGuests(fallbackPlace)
                    ? `${people} ${people === 1 ? "persona" : "personas"}`
                    : current.status === "PENDING" ? "Reservado" : "En curso"
                  : "Libre";
                return (
                  <button
                    key={unit.id}
                    type="button"
                    className={`quick-resource ${tone}`}
                    disabled={busy}
                    onClick={() => {
                      if (current && placeTracksGuests(fallbackPlace)) {
                        setPeek({ booking: current, place: fallbackPlace, unit });
                        return;
                      }
                      onSpot(unit, current, fallbackPlace, true);
                    }}
                  >
                    <strong>{code}</strong>
                    <span className="service-icon"><Icon name={fallbackPlace.icon ?? "map"} /></span>
                    <small>{status}</small>
                  </button>
                );
              })}
            </div>
            <p className="rapida-hint">Toca un sitio libre para ocuparlo. Puedes completar los datos después</p>
          </div>
        ) : null}

        {view === "whatsapp" ? (
          <FloorWhatsApp
            initialChatId={waJump}
            onConsumedInitial={() => setWaJump(null)}
          />
        ) : null}

        {view === "mas" ? (
          <div className="panel">
            <h1 className="mas-title">Más</h1>
            {companies.length > 1 ? (
              <select className="company-pick" value={company.id} onChange={(e) => onCompanyChange(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : null}
            <div className="more-tools">
              <button type="button" onClick={() => openPlaces("mas")}>
                <Icon name="gear" />
                <span>Lugares y sitios<small>Cuántos glampings, botes o mesas hay</small></span>
              </button>
              <button type="button" onClick={openClosedDays}>
                <Icon name="calendar" />
                <span>Días cerrados<small>Bloquean visitas y reservas en todos lados</small></span>
              </button>
              <button type="button" onClick={() => setView("mapa")}>
                <Icon name="map" />
                <span>Mapa del lago<small>Puntos y ocupación</small></span>
              </button>
              <button type="button" onClick={onLogout}>
                <Icon name="logout" />
                <span>Cerrar sesión<small>{name}</small></span>
              </button>
            </div>
          </div>
        ) : null}

        {view === "lugares" ? (
          <div className="panel places-panel">
            <PlacesEditor places={draftPlaces} onChange={setDraftPlaces} />
            {error ? <p className="form-error">{error}</p> : null}
            <button type="button" className="btn full" disabled={busy} onClick={() => void savePlaces()}>
              {busy ? "Guardando…" : "Guardar lugares"}
            </button>
          </div>
        ) : null}

        {view === "cerrados" ? (
          <div className="panel closed-panel">
            <h1 className="mas-title">Días cerrados</h1>
            <p className="heading-subtitle">
              Toca un día para cerrarlo. Esos días no se reservan en la web, WhatsApp ni en el móvil.
            </p>
            {(() => {
              const pack = closedMonthDays(closedMonth);
              const [y, m] = closedMonth.split("-").map(Number);
              const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
              const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
              return (
                <div className="closed-cal">
                  <div className="closed-cal-head">
                    <button type="button" aria-label="Mes anterior" onClick={() => setClosedMonth(prev)}>‹</button>
                    <strong>{pack.title}</strong>
                    <button type="button" aria-label="Mes siguiente" onClick={() => setClosedMonth(next)}>›</button>
                  </div>
                  <div className="closed-weekdays">
                    {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="closed-days">
                    {Array.from({ length: pack.offset }, (_, i) => (
                      <span key={`e${i}`} className="closed-empty" />
                    ))}
                    {Array.from({ length: pack.days }, (_, i) => {
                      const ymd = `${closedMonth}-${String(i + 1).padStart(2, "0")}`;
                      const closed = draftClosed.includes(ymd);
                      const past = ymd < today;
                      return (
                        <button
                          key={ymd}
                          type="button"
                          className={`closed-day${closed ? " is-closed" : ""}${ymd === today ? " is-today" : ""}`}
                          disabled={past}
                          aria-pressed={closed}
                          onClick={() => toggleClosedDay(ymd)}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <p className="closed-legend">
                    <span className="swatch closed" /> Cerrado · no se reserva
                  </p>
                  {draftClosed.length ? (
                    <ul className="closed-list">
                      {draftClosed.filter((d) => d >= today).map((d) => (
                        <li key={d}>
                          <span>{longDate(d)}</span>
                          <button type="button" onClick={() => toggleClosedDay(d)}>Abrir</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="heading-subtitle">Ningún día cerrado por ahora.</p>
                  )}
                </div>
              );
            })()}
            {error ? <p className="form-error">{error}</p> : null}
            <button type="button" className="btn full" disabled={busy} onClick={() => void saveClosedDays()}>
              {busy ? "Guardando…" : "Guardar días cerrados"}
            </button>
          </div>
        ) : null}
      </main>

      {peek ? (
        <div className="sheet">
          <button type="button" className="sheet-scrim" aria-label="Cerrar" onClick={() => setPeek(null)} />
          <div className="sheet-card peek-card">
            <div className="sheet-head">
              <h2>{unitCode(peek.place, peek.unit.n)}</h2>
              <button type="button" className="icon-button" aria-label="Cerrar" onClick={() => setPeek(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="sheet-body">
              <p className="peek-people">{guestCount(peek.booking)}</p>
              <p className="peek-label">{guestCount(peek.booking) === 1 ? `persona en ${peek.place.name.toLowerCase()}` : `personas en ${peek.place.name.toLowerCase()}`}</p>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn full"
                  disabled={busy}
                  onClick={() => {
                    onSpot(peek.unit, peek.booking, peek.place, true);
                    setPeek(null);
                  }}
                >
                  Liberar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!online || queued ? (
        <p className={`offline-bar${online ? " syncing" : ""}`}>
          {online ? `Hay internet · enviando ${queued} cambio${queued === 1 ? "" : "s"}` : "Sin internet · se guarda aquí y se actualiza al conectar"}
        </p>
      ) : null}

      {toast ? <div id="toast" className="visible">{toast}</div> : <div id="toast" />}

      <nav className="bottom-nav">
        <button type="button" className={`nav-link${view === "inicio" ? " active" : ""}`} onClick={() => setView("inicio")}>
          <Icon name="home" /><span>Inicio</span>
        </button>
        <button type="button" className={`nav-link${view === "rapida" ? " active" : ""}`} onClick={() => setView("rapida")}>
          <Icon name="plus" /><span>Rápida</span>
        </button>
        <button type="button" className={`nav-link${view === "mapa" ? " active" : ""}`} onClick={() => setView("mapa")}>
          <Icon name="map" /><span>Mapa</span>
        </button>
        <button type="button" className={`nav-link${view === "agenda" ? " active" : ""}`} onClick={() => setView("agenda")}>
          <Icon name="calendar" /><span>Reservas</span>
        </button>
        <button
          type="button"
          className={`nav-link${view === "whatsapp" ? " active" : ""}`}
          onClick={() => setView("whatsapp")}
        >
          <Icon name="chat" />
          <span>WhatsApp{waPending ? ` (${waPending})` : ""}</span>
        </button>
        <button type="button" className={`nav-link${view === "mas" || view === "lugares" ? " active" : ""}`} onClick={() => setView("mas")}>
          <Icon name="more" /><span>Más</span>
        </button>
      </nav>
    </div>
  );
}
