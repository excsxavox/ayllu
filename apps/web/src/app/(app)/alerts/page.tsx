"use client";

import { api } from "@/lib/api";
import { NavLink } from "@/lib/app-path";
import { useApiGet } from "@/lib/use-api-get";
import { notifyAlertsChanged } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { useConfirm } from "@/components/confirm-dialog";

type Alert = {
  id: string;
  type: string;
  title: string;
  body: string;
  conversationId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

const LABELS: Record<string, string> = {
  NEW_CONVERSATION: "Nueva conversación",
  HUMAN_TAKEOVER: "Asesor",
  BOT_FALLBACK: "Sin respuesta precisa",
  OUTSIDE_HOURS: "Fuera de horario",
  NEEDS_REPLY: "Pendiente",
  PAYMENT_PROOF: "Comprobante",
};

export default function AlertsPage() {
  const { ask } = useConfirm();
  const { data: items, setData: setItems } = useApiGet<Alert[]>("/alerts");
  const unread = items?.filter((a) => !a.readAt).length ?? 0;

  async function markOne(id: string) {
    setItems((prev) => prev?.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a)) ?? null);
    notifyAlertsChanged();
    await api(`/alerts/${id}/read`, { method: "POST" }).catch(() => undefined);
    notifyAlertsChanged();
  }

  async function markAll() {
    setItems((prev) => prev?.map((a) => ({ ...a, readAt: a.readAt ?? new Date().toISOString() })) ?? null);
    notifyAlertsChanged();
    await api("/alerts/read-all", { method: "POST" }).catch(() => undefined);
    notifyAlertsChanged();
  }

  async function clearAll() {
    if (!items?.length) return;
    const ok = await ask({
      title: `¿Borrar las ${items.length} alertas?`,
      body: "Se vacía esta lista. Las nuevas seguirán llegando.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    setItems([]);
    notifyAlertsChanged();
    await api("/alerts/clear", { method: "POST" }).catch(() => undefined);
    notifyAlertsChanged();
  }

  return (
    <div>
      <PageHeader
        actions={
          items?.length ? (
            <div className="row">
              {unread > 0 && (
                <button className="btn ghost" onClick={markAll}>
                  Marcar {unread} como leídas
                </button>
              )}
              <button className="btn ghost" onClick={clearAll}>
                Limpiar alertas
              </button>
            </div>
          ) : undefined
        }
      />
      <div className="card">
        {items === null && <LoadingState compact label="Cargando avisos…" />}
        {items && !items.length && (
          <EmptyState
            title="Sin avisos"
            body="Cuando el bot no pueda cerrar solo un chat, el aviso aparece aquí con un enlace a la bandeja."
          />
        )}
        {items?.map((a) => (
          <div key={a.id} className={`alert-row ${a.readAt ? "" : "unread"}`}>
            <div>
              <span className={a.readAt ? "badge" : "badge warn"}>{LABELS[a.type] ?? a.type}</span>
              <strong> {a.title}</strong>
              <p className="muted">{a.body}</p>
              <p className="muted">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
            <div className="row">
              {a.conversationId && (
                <NavLink className="btn" href={`/inbox?c=${a.conversationId}`}>
                  Abrir chat
                </NavLink>
              )}
              {!a.readAt && (
                <button className="btn ghost" onClick={() => markOne(a.id)}>
                  Hecho
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
