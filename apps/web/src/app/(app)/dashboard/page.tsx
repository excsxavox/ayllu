"use client";

import { useMemo, useState } from "react";
import { NavLink } from "@/lib/app-path";
import { useApiGet } from "@/lib/use-api-get";
import { useMounted } from "@/lib/use-mounted";
import { Icon } from "@/components/icons";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";

type AttentionReason = "advisor" | "proof" | "noreply";
type Period = "today" | "yesterday" | "week";

type Dashboard = {
  companyName: string;
  kpis: {
    conversations: { value: number };
    pending: { value: number };
    resolved: { value: number };
    conversationsToday?: number;
    conversationsYesterday?: number;
    handover?: number;
    resolvedToday?: number;
  };
  attention?: Array<{ id: string; name: string; reason: AttentionReason; waitMinutes: number }>;
  assistant?: {
    replyMode?: "AUTO" | "HYBRID" | "MANUAL";
    whatsappConnected?: boolean;
    lastSyncAt?: string | null;
  };
};

const REASON: Record<AttentionReason, string> = {
  advisor: "Solicitó un asesor",
  proof: "Comprobante por revisar",
  noreply: "Sin respuesta",
};

const MODE: Record<string, string> = {
  AUTO: "Automático",
  HYBRID: "Híbrido",
  MANUAL: "Manual",
};

const SAMPLE_ATTENTION: Dashboard["attention"] = [
  { id: "demo-1", name: "María G.", reason: "advisor", waitMinutes: 12 },
  { id: "demo-2", name: "Carlos P.", reason: "proof", waitMinutes: 8 },
  { id: "demo-3", name: "Andrea R.", reason: "advisor", waitMinutes: 6 },
  { id: "demo-4", name: "Luis M.", reason: "noreply", waitMinutes: 4 },
  { id: "demo-5", name: "Sofía C.", reason: "advisor", waitMinutes: 2 },
];

const TONES = [
  ["#ede9fe", "#6d28d9"],
  ["#ffedd5", "#c2410c"],
  ["#dcfce7", "#15803d"],
  ["#dbeafe", "#1d4ed8"],
  ["#fce7f3", "#be185d"],
  ["#ccfbf1", "#0f766e"],
];

export default function DashboardPage() {
  const mounted = useMounted();
  const { data: stats } = useApiGet<Dashboard>("/dashboard");
  const [examples, setExamples] = useState(false);
  const [period, setPeriod] = useState<Period>("today");

  const kpis = useMemo(() => {
    if (examples) {
      return { conversations: 64, pending: 8, handover: 3, resolved: 48 };
    }
    const real = stats?.kpis;
    if (period === "yesterday") {
      return {
        conversations: real?.conversationsYesterday ?? 0,
        pending: real?.pending.value ?? 0,
        handover: real?.handover ?? 0,
        resolved: real?.resolvedToday ?? 0,
      };
    }
    if (period === "week") {
      return {
        conversations: real?.conversations.value ?? 0,
        pending: real?.pending.value ?? 0,
        handover: real?.handover ?? 0,
        resolved: real?.resolved.value ?? 0,
      };
    }
    return {
      conversations: real?.conversationsToday ?? real?.conversations.value ?? 0,
      pending: real?.pending.value ?? 0,
      handover: real?.handover ?? 0,
      resolved: real?.resolvedToday ?? 0,
    };
  }, [examples, period, stats]);

  const attention = examples ? SAMPLE_ATTENTION : (stats?.attention ?? []);
  const shown = attention.slice(0, 5);
  const assistant = examples
    ? { replyMode: "AUTO" as const, whatsappConnected: true, lastSyncAt: new Date(Date.now() - 60_000).toISOString() }
    : stats?.assistant;
  const connected = Boolean(assistant?.whatsappConnected);
  const mode = MODE[assistant?.replyMode ?? "AUTO"] ?? "Automático";

  if (!mounted || stats === null) return <LoadingState label="Cargando panel…" />;

  return (
    <div className="panel">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
              <span>Datos de ejemplo</span>
            </label>
            <label className="panel-period">
              <Icon name="calendar" />
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Periodo">
                <option value="today">Hoy</option>
                <option value="yesterday">Ayer</option>
                <option value="week">7 días</option>
              </select>
            </label>
            <NavLink href="/inbox" className="btn ink">
              Abrir bandeja
            </NavLink>
          </>
        }
      />

      <div className="panel-kpis">
        <Kpi icon="chat" title="Conversaciones hoy" value={kpis.conversations} hint="Mensajes de tus clientes" />
        <Kpi icon="hourglass" title="Pendientes de atención" value={kpis.pending} hint="Requieren una respuesta" />
        <Kpi icon="user" title="Solicitaron un asesor" value={kpis.handover} hint={`Incluidas en las ${kpis.pending} pendientes`} />
        <Kpi icon="check-circle" title="Resueltas hoy" value={kpis.resolved} hint="Conversaciones finalizadas" />
      </div>

      <div className="panel-mid">
        <section className="panel-card">
          <header>
            <div>
              <h2>
                Necesitan atención
                {attention.length ? <em>{attention.length}</em> : null}
              </h2>
              <p>Abre una conversación para continuar la atención.</p>
            </div>
          </header>
          {shown.length === 0 ? (
            <p className="panel-empty">Nada pendiente. El equipo está al día.</p>
          ) : (
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Espera</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="panel-who">
                        <i style={avatarTone(row.name)}>{initials(row.name)}</i>
                        <strong>{row.name}</strong>
                      </span>
                    </td>
                    <td>
                      <span className={`panel-reason ${row.reason}`}>{REASON[row.reason]}</span>
                    </td>
                    <td>{formatWait(row.waitMinutes)}</td>
                    <td>
                      <NavLink href={row.id.startsWith("demo-") ? "/inbox" : `/inbox?c=${row.id}`} className="panel-open">
                        Abrir chat
                        <Icon name="chevron-right" />
                      </NavLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <footer>
            <p>
              {shown.length
                ? `Mostrando ${shown.length} de ${attention.length} pendiente${attention.length === 1 ? "" : "s"}`
                : "Sin pendientes"}
            </p>
            <NavLink href="/inbox">Ver todas</NavLink>
          </footer>
        </section>

        <aside className="panel-card panel-asst">
          <h2>Estado del asistente</h2>
          <div className="panel-asst-hero">
            <span className={`panel-asst-ico${connected ? "" : " off"}`}>
              <Icon name="bot" />
            </span>
            <div>
              <strong>{connected ? "Asistente activo" : "Asistente en pausa"}</strong>
              <p>{connected ? "Atendiendo conversaciones" : "Revisa el canal de WhatsApp"}</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Modo de atención</dt>
              <dd>{mode}</dd>
            </div>
            <div>
              <dt>Canal de WhatsApp</dt>
              <dd className={connected ? "ok" : "bad"}>
                <i />
                {connected ? "Conectado" : "Sin conectar"}
              </dd>
            </div>
            <div>
              <dt>Última sincronización</dt>
              <dd>{formatAgo(assistant?.lastSyncAt)}</dd>
            </div>
          </dl>
          <p className={`panel-asst-ok${connected ? "" : " warn"}`}>
            <Icon name="check-circle" />
            {connected ? "Tu canal está funcionando" : "Falta conectar WhatsApp"}
          </p>
          <div className="panel-asst-actions">
            <NavLink href="/settings" className="btn ghost">
              <Icon name="gear" />
              Configurar asistente
            </NavLink>
            <NavLink href="/channels" className="btn ghost">
              <Icon name="radio" />
              Gestionar canales
            </NavLink>
          </div>
        </aside>
      </div>

      <section>
        <h2 className="panel-quick-title">Accesos rápidos</h2>
        <div className="panel-quick">
          <NavLink href="/replies">
            <Icon name="chat" />
            <span>
              <b>Respuestas guardadas</b>
              <small>Edita tus mensajes frecuentes</small>
            </span>
            <Icon name="chevron-right" />
          </NavLink>
          <NavLink href="/payments">
            <Icon name="building" />
            <span>
              <b>Métodos de pago</b>
              <small>Actualiza cuentas y enlaces</small>
            </span>
            <Icon name="chevron-right" />
          </NavLink>
          <NavLink href="/services">
            <Icon name="sliders" />
            <span>
              <b>Servicios</b>
              <small>Gestiona lo que ofreces</small>
            </span>
            <Icon name="chevron-right" />
          </NavLink>
          <NavLink href="/promotions">
            <Icon name="tag" />
            <span>
              <b>Promociones</b>
              <small>Administra tus ofertas</small>
            </span>
            <Icon name="chevron-right" />
          </NavLink>
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon, title, value, hint }: { icon: string; title: string; value: number; hint: string }) {
  return (
    <article className="panel-kpi">
      <span>
        <Icon name={icon} />
      </span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function avatarTone(name: string) {
  let n = 0;
  for (const ch of name) n += ch.charCodeAt(0);
  const [bg, color] = TONES[n % TONES.length];
  return { background: bg, color };
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h`;
}

function formatAgo(iso?: string | null) {
  if (!iso) return "Sin datos";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Ahora";
  if (mins === 1) return "Hace 1 minuto";
  if (mins < 60) return `Hace ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "Hace 1 hora";
  return `Hace ${hours} horas`;
}
