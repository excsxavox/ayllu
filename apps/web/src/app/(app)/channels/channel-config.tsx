"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/icons";
import { NavLink } from "@/lib/app-path";

export type ChannelFlow = { id: string; name: string; isDefault: boolean };
export type ChannelDraft = {
  id: string;
  type: string;
  name: string;
  handle?: string | null;
  isActive: boolean;
  flowId?: string | null;
  flow?: ChannelFlow | null;
  whatsappAccount?: { id: string; displayPhone?: string | null; isActive: boolean; provider: string } | null;
  _count?: { conversations: number };
};

export function emptyChannel(defaultFlowId?: string | null): ChannelDraft {
  return {
    id: "",
    type: "WHATSAPP",
    name: "WhatsApp",
    handle: "",
    isActive: true,
    flowId: defaultFlowId ?? null,
    _count: { conversations: 0 },
  };
}

export function ChannelConfig({
  channel,
  flows,
  onCancel,
  onSaved,
}: {
  channel: ChannelDraft;
  flows: ChannelFlow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isNew = !channel.id;
  const [name, setName] = useState(channel.name);
  const [handle, setHandle] = useState(channel.handle ?? "");
  const [flowId, setFlowId] = useState(channel.flowId ?? "");
  const [isActive, setIsActive] = useState(channel.isActive);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const connected = Boolean(channel.whatsappAccount);
  const phone = channel.whatsappAccount?.displayPhone || handle || "Sin número";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Ponle un nombre al canal.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      type: "WHATSAPP",
      name: name.trim(),
      handle: handle.trim() || null,
      flowId: flowId || null,
      isActive,
    };
    try {
      if (channel.id) await api(`/channels/${channel.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/channels", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el canal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="ch-cfg" onSubmit={onSubmit}>
      <div className="rule-cfg-top">
        <button type="button" className="pay-cfg-back" onClick={onCancel}>
          <Icon name="chevron-left" />
          Volver a canales
        </button>
        <div className="rule-cfg-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Descartar
          </button>
          <button className="btn" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <header className="pay-cfg-head">
        <div>
          <h1>{isNew ? "Nuevo canal" : "Configurar canal"}</h1>
          <p>WhatsApp es el único canal activo. Elige el flujo que responde en este número.</p>
        </div>
      </header>

      {error ? <p className="pay-cfg-error">{error}</p> : null}

      <div className="flow-cfg-board">
        <div className="flow-cfg-main">
          <section className="rule-block">
            <div className="rule-block-head">
              <span className="rule-step-ico">
                <Icon name="phone" />
              </span>
              <div>
                <h2>Información del canal</h2>
              </div>
            </div>
            <div className="rule-fields">
              <label>
                <span>Nombre</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="WhatsApp Ayllu" />
              </label>
              <label>
                <span>Número o identificador</span>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="+51 900 000 000" />
              </label>
              <div className="rule-active">
                <span>Activo</span>
                <button
                  type="button"
                  className="pay-switch"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                >
                  <i />
                </button>
              </div>
            </div>
          </section>

          <section className="rule-block">
            <div className="rule-block-head">
              <span className="rule-num">1</span>
              <span className="rule-step-ico">
                <Icon name="wand" />
              </span>
              <div>
                <h2>Flujo que responde</h2>
                <p>Las conversaciones de este número usan estas instrucciones.</p>
              </div>
            </div>
            <label>
              <span>Flujo</span>
              <select value={flowId} onChange={(e) => setFlowId(e.target.value)}>
                <option value="">Flujo predeterminado</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                    {flow.isDefault ? " · predeterminado" : ""}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>

        <aside className="rule-try">
          <h2>Estado de WhatsApp</h2>
          <article className={`rule-result-card${connected ? "" : " warn"}`}>
            <span>
              <Icon name={connected ? "check-circle" : "bell"} />
            </span>
            <div>
              <strong>{connected ? "Número conectado" : "Aún no hay cuenta de Meta"}</strong>
              <p>{connected ? phone : "Guarda el canal y completa el token en Configuración."}</p>
            </div>
          </article>
          <dl className="flow-summary">
            <div>
              <dt>Conversaciones</dt>
              <dd>{channel._count?.conversations ?? 0}</dd>
            </div>
            <div>
              <dt>Proveedor</dt>
              <dd>{channel.whatsappAccount?.provider === "META" ? "Meta Cloud" : "WhatsApp"}</dd>
            </div>
          </dl>
          <NavLink href="/settings" className="flow-set">
            Ir a configuración de WhatsApp
          </NavLink>
        </aside>
      </div>
    </form>
  );
}
