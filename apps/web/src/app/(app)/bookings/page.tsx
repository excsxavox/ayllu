"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { BookingCalendar } from "@/components/booking-calendar";
import { PlacesEditor } from "@/components/places-editor";
import { Icon } from "@/components/icons";
import { DEFAULT_BOOKING_PLACES, type BookingPlace } from "@aylluu/shared";

type CatalogItem = {
  id: string;
  name: string;
  durationMinutes?: number | null;
  isActive: boolean;
  isAddon?: boolean;
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

type Settings = {
  title: string;
  mode: "SERVICES" | "PRODUCTS" | "BOTH";
  slotMinutes: number;
  bufferMinutes: number;
  maxPerSlot: number;
  maxPerDay: number;
  horizonDays: number;
  weeklyHours: WeeklyHours;
  customFields: CustomField[];
  confirmationMessage?: string | null;
  cancelPolicy?: string | null;
  bookableServiceIds: string[];
  bookableProductIds: string[];
  requirePhone: boolean;
  requireEmail: boolean;
  autoConfirm: boolean;
  allowBotBooking: boolean;
  depositPercent?: number;
  places?: BookingPlace[];
};

const DAYS: Array<{ key: keyof WeeklyHours; label: string }> = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

export default function BookingsPage() {
  const company = useApiGet<{ bookingsEnabled?: boolean; timezone?: string }>("/companies/current");
  const enabled = company.data?.bookingsEnabled === true;
  const [tab, setTab] = useState<"agenda" | "settings">("agenda");

  if (company.data === null) {
    return (
      <div className="stack bookings-page">
        <LoadingState label="Cargando reservas…" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="stack bookings-page">
        <BookingsHeading tab={tab} onTab={setTab} />
        <div className="card">
          <EmptyState
            title="Reservas no están en el plan"
            body="Este extra lo enciende a mano un administrador de AYLLUU cuando la empresa lo contrata. El menú no aparece hasta entonces."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="stack bookings-page">
      <BookingsHeading tab={tab} onTab={setTab} />
      {tab === "agenda" ? (
        <AgendaPanel timezone={company.data.timezone ?? "America/Lima"} />
      ) : (
        <SettingsPanel />
      )}
    </div>
  );
}

function BookingsHeading({
  tab,
  onTab,
}: {
  tab: "agenda" | "settings";
  onTab: (tab: "agenda" | "settings") => void;
}) {
  return (
    <div className="page-head bookings-head">
      <div>
        <h1>Agenda</h1>
        <p>
          {tab === "agenda"
            ? "Tus reservas y actividades, en un solo lugar."
            : "Horarios, lugares, sitios y campos que pide el bot al reservar."}
        </p>
      </div>
      <div className="bookings-tabs">
        <button type="button" className={tab === "agenda" ? "on" : ""} onClick={() => onTab("agenda")}>
          <Icon name="calendar" />
          Agenda
        </button>
        <button type="button" className={tab === "settings" ? "on" : ""} onClick={() => onTab("settings")}>
          <Icon name="gear" />
          Personalizar
        </button>
      </div>
    </div>
  );
}

function AgendaPanel({ timezone }: { timezone: string }) {
  const { data: settings } = useApiGet<Settings>("/bookings/settings");
  if (!settings) {
    return (
      <div className="card">
        <LoadingState compact label="Cargando calendario…" />
      </div>
    );
  }
  return <BookingCalendar settings={settings} timezone={timezone} />;
}

function SettingsPanel() {
  const { data: settings, reload } = useApiGet<Settings>("/bookings/settings");
  const { data: services } = useApiGet<CatalogItem[]>("/services");
  const { data: products } = useApiGet<CatalogItem[]>("/products");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [places, setPlaces] = useState<BookingPlace[]>(settings?.places?.length ? settings.places : DEFAULT_BOOKING_PLACES);

  useEffect(() => {
    if (settings?.places?.length) setPlaces(settings.places);
  }, [settings]);

  if (!settings) {
    return (
      <div className="card">
        <LoadingState compact label="Cargando personalización…" />
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const weeklyHours = Object.fromEntries(
      DAYS.map(({ key }) => {
        const enabled = form.get(`open_${key}`) === "on";
        const start = String(form.get(`start_${key}`) || "09:00");
        const end = String(form.get(`end_${key}`) || "18:00");
        return [key, enabled ? [{ start, end }] : []];
      }),
    ) as WeeklyHours;
    const customFields: CustomField[] = [];
    for (let i = 0; i < 12; i++) {
      const label = String(form.get(`cf_label_${i}`) || "").trim();
      const key = String(form.get(`cf_key_${i}`) || "").trim();
      if (!label && !key) continue;
      customFields.push({
        key: key || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
        label: label || key,
        type: String(form.get(`cf_type_${i}`) || "text") as CustomField["type"],
        required: form.get(`cf_req_${i}`) === "on",
        options: String(form.get(`cf_opts_${i}`) || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }
    try {
      await api("/bookings/settings", {
        method: "PATCH",
        body: JSON.stringify({
          title: form.get("title"),
          mode: form.get("mode"),
          slotMinutes: Number(form.get("slotMinutes")),
          bufferMinutes: Number(form.get("bufferMinutes")),
          maxPerSlot: Number(form.get("maxPerSlot")),
          maxPerDay: Number(form.get("maxPerDay")),
          horizonDays: Number(form.get("horizonDays")),
          weeklyHours,
          customFields,
          confirmationMessage: String(form.get("confirmationMessage") || "") || null,
          cancelPolicy: String(form.get("cancelPolicy") || "") || null,
          bookableServiceIds: form.getAll("bookableServiceIds"),
          bookableProductIds: form.getAll("bookableProductIds"),
          requirePhone: form.get("requirePhone") === "on",
          requireEmail: form.get("requireEmail") === "on",
          autoConfirm: form.get("autoConfirm") === "on",
          allowBotBooking: form.get("allowBotBooking") === "on",
          depositPercent: Number(form.get("depositPercent") || 50),
          places,
        }),
      });
      setSaved(true);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const hours = settings.weeklyHours ?? ({} as WeeklyHours);
  const fields = [...(settings.customFields ?? [])];
  while (fields.length < 3) fields.push({ key: "", label: "", type: "text", required: false, options: [] });

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Cómo reserva esta empresa</h2>
      <p className="muted">Cambia el nombre, qué se reserva y el horario. El bot usa esto solo si el plan está activo.</p>
      <div className="row">
        <label style={{ flex: 2 }}>
          <span>Nombre del módulo</span>
          <input name="title" defaultValue={settings.title} required placeholder="Citas" />
        </label>
        <label>
          <span>Qué se reserva</span>
          <select name="mode" defaultValue={settings.mode}>
            <option value="SERVICES">Solo servicios</option>
            <option value="PRODUCTS">Solo productos</option>
            <option value="BOTH">Servicios y productos</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          <span>Duración del turno (min)</span>
          <input name="slotMinutes" type="number" min={5} defaultValue={settings.slotMinutes} />
        </label>
        <label>
          <span>Descanso entre turnos</span>
          <input name="bufferMinutes" type="number" min={0} defaultValue={settings.bufferMinutes} />
        </label>
        <label>
          <span>Cupos a la misma hora</span>
          <input name="maxPerSlot" type="number" min={1} defaultValue={settings.maxPerSlot} />
        </label>
        <label>
          <span>Máximo por día</span>
          <input name="maxPerDay" type="number" min={1} max={500} defaultValue={settings.maxPerDay ?? 8} />
        </label>
        <label>
          <span>Días hacia adelante</span>
          <input name="horizonDays" type="number" min={1} defaultValue={settings.horizonDays} />
        </label>
      </div>

      <PlacesEditor places={places} onChange={setPlaces} />

      <h3>Horario</h3>
      {DAYS.map(({ key, label }) => {
        const slot = hours[key]?.[0];
        return (
          <div className="row hours-row" key={key}>
            <label className="check">
              <input type="checkbox" name={`open_${key}`} defaultChecked={Boolean(slot)} />
              <span>{label}</span>
            </label>
            <label>
              <span>Desde</span>
              <input name={`start_${key}`} type="time" defaultValue={slot?.start ?? "09:00"} />
            </label>
            <label>
              <span>Hasta</span>
              <input name={`end_${key}`} type="time" defaultValue={slot?.end ?? "18:00"} />
            </label>
          </div>
        );
      })}

      {(settings.mode === "SERVICES" || settings.mode === "BOTH") && (
        <fieldset className="pick-set">
          <legend>Servicios que se pueden reservar</legend>
          <p className="muted">Si no marcas ninguno, entran todos los activos.</p>
          <div className="chips">
            {(services ?? []).filter((s) => s.isActive).map((s) => (
              <label className="chip-check" key={s.id}>
                <input
                  type="checkbox"
                  name="bookableServiceIds"
                  value={s.id}
                  defaultChecked={settings.bookableServiceIds.includes(s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {(settings.mode === "PRODUCTS" || settings.mode === "BOTH") && (
        <fieldset className="pick-set">
          <legend>Productos que se pueden reservar</legend>
          <p className="muted">Si no marcas ninguno, entran todos los activos.</p>
          <div className="chips">
            {(products ?? []).filter((p) => p.isActive && !p.isAddon).map((p) => (
              <label className="chip-check" key={p.id}>
                <input
                  type="checkbox"
                  name="bookableProductIds"
                  value={p.id}
                  defaultChecked={settings.bookableProductIds.includes(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <h3>Campos extra del formulario</h3>
      <p className="muted">Clave en minúsculas, sin espacios. En opciones, separa con comas.</p>
      {fields.map((field, i) => (
        <div className="row" key={`cf-${i}`}>
          <label>
            <span>Etiqueta</span>
            <input name={`cf_label_${i}`} defaultValue={field.label} placeholder="Motivo" />
          </label>
          <label>
            <span>Clave</span>
            <input name={`cf_key_${i}`} defaultValue={field.key} placeholder="motivo" />
          </label>
          <label>
            <span>Tipo</span>
            <select name={`cf_type_${i}`} defaultValue={field.type}>
              <option value="text">Texto</option>
              <option value="textarea">Párrafo</option>
              <option value="phone">Teléfono</option>
              <option value="email">Correo</option>
              <option value="number">Número</option>
              <option value="select">Lista</option>
            </select>
          </label>
          <label>
            <span>Opciones</span>
            <input name={`cf_opts_${i}`} defaultValue={(field.options ?? []).join(", ")} placeholder="A, B" />
          </label>
          <label className="check">
            <input type="checkbox" name={`cf_req_${i}`} defaultChecked={field.required} />
            <span>Obligatorio</span>
          </label>
        </div>
      ))}

      <label>
        <span>Mensaje de confirmación</span>
        <textarea
          name="confirmationMessage"
          rows={2}
          defaultValue={settings.confirmationMessage ?? ""}
          placeholder="Tu cita quedó registrada. Te escribimos si hay un cambio."
        />
      </label>
      <label>
        <span>Política de cancelación</span>
        <textarea name="cancelPolicy" rows={2} defaultValue={settings.cancelPolicy ?? ""} />
      </label>
      <div className="row">
        <label className="check">
          <input type="checkbox" name="requirePhone" defaultChecked={settings.requirePhone} />
          <span>Pedir teléfono</span>
        </label>
        <label className="check">
          <input type="checkbox" name="requireEmail" defaultChecked={settings.requireEmail} />
          <span>Pedir correo</span>
        </label>
        <label className="check">
          <input type="checkbox" name="autoConfirm" defaultChecked={settings.autoConfirm} />
          <span>Confirmar al registrar</span>
        </label>
        <label className="check">
          <input type="checkbox" name="allowBotBooking" defaultChecked={settings.allowBotBooking} />
          <span>El bot puede hablar de reservas</span>
        </label>
        <label>
          <span>Adelanto para reservar (%)</span>
          <input
            name="depositPercent"
            type="number"
            min={1}
            max={100}
            defaultValue={settings.depositPercent ?? 50}
          />
        </label>
      </div>
      <p className="muted">
        El cliente deja la reserva pagando ese porcentaje por transferencia y envía la captura. El bot no confirma el pago: se crea una alerta para que lo validen.
      </p>
      {error && <p className="error">{error}</p>}
      {saved && <p className="muted">Cambios guardados.</p>}
      <button className="btn">Guardar personalización</button>
    </form>
  );
}
