"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/icons";
import { channelMeta } from "@/lib/channels";
import { NavLink } from "@/lib/app-path";
import { CREATE_PROMPT, SCENARIOS, emptyFlow, simulateFlow, type FlowDraft } from "./model";

type Channel = { id: string; name: string; type: string; flowId?: string | null };
type Rule = { id: string; name: string; flowId?: string | null };

export function FlowForm({
  flow,
  channels,
  rules,
  onCancel,
  onSaved,
}: {
  flow: FlowDraft;
  channels: Channel[];
  rules: Rule[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isNew = !flow.id;
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description ?? "");
  const [prompt, setPrompt] = useState(flow.systemPrompt ?? (isNew ? CREATE_PROMPT : ""));
  const [isDefault, setIsDefault] = useState(flow.isDefault);
  const [channelIds, setChannelIds] = useState<string[]>(
    (flow.channels ?? []).map((item) => item.id).filter((id) => channels.some((ch) => ch.id === id)),
  );
  const [ruleIds, setRuleIds] = useState<string[]>(
    (flow.rules ?? []).map((item) => item.id).filter((id) => rules.some((rule) => rule.id === id)),
  );
  const [tab, setTab] = useState<"prompt" | "channels" | "rules">("prompt");
  const [openPick, setOpenPick] = useState<"channels" | "rules" | null>(null);
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]["id"]>("reserve");
  const [expected, setExpected] = useState(() => simulateFlow(flow.systemPrompt ?? CREATE_PROMPT, "reserve"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectableChannels = channels.filter((ch) => ch.type === "WHATSAPP" || channelIds.includes(ch.id));
  const dirty =
    name !== flow.name ||
    description !== (flow.description ?? "") ||
    prompt !== (flow.systemPrompt ?? "") ||
    isDefault !== flow.isDefault ||
    channelIds.slice().sort().join() !== (flow.channels ?? []).map((c) => c.id).slice().sort().join() ||
    ruleIds.slice().sort().join() !== (flow.rules ?? []).map((r) => r.id).slice().sort().join();

  const selectedChannels = useMemo(
    () => selectableChannels.filter((ch) => channelIds.includes(ch.id)),
    [channelIds, selectableChannels],
  );
  const selectedRules = useMemo(() => rules.filter((rule) => ruleIds.includes(rule.id)), [ruleIds, rules]);

  function toggle(list: string[], id: string, setList: (next: string[]) => void) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function runTest() {
    setExpected(simulateFlow(prompt, scenario));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim() || !prompt.trim()) {
      setError("Completa el nombre y las instrucciones.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      systemPrompt: prompt.trim(),
      tone: flow.tone || "cálido",
      replyMode: flow.replyMode || "AUTO",
      isDefault,
      channelIds,
      ruleIds,
    };
    try {
      if (flow.id) await api(`/flows/${flow.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/flows", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el flujo.");
    } finally {
      setSaving(false);
    }
  }

  const picker = (kind: "channels" | "rules") => (
    <div className="flow-pick">
      <button type="button" className="flow-pick-btn" onClick={() => setOpenPick((v) => (v === kind ? null : kind))}>
        {kind === "channels" ? "Seleccionar canales" : "Seleccionar reglas"}
        <Icon name="chevron-down" />
      </button>
      <small>
        {kind === "channels" ? `${channelIds.length} seleccionados` : `${ruleIds.length} seleccionadas`}
      </small>
      {openPick === kind ? (
        <div className="flow-pick-pop">
          {(kind === "channels" ? selectableChannels : rules).length ? (
            (kind === "channels" ? selectableChannels : rules).map((item) => {
              const checked = kind === "channels" ? channelIds.includes(item.id) : ruleIds.includes(item.id);
              return (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      kind === "channels" ? toggle(channelIds, item.id, setChannelIds) : toggle(ruleIds, item.id, setRuleIds)
                    }
                  />
                  <span>{item.name}</span>
                </label>
              );
            })
          ) : (
            <p>No hay {kind === "channels" ? "canales de WhatsApp" : "reglas"} todavía.</p>
          )}
        </div>
      ) : null}
    </div>
  );

  if (isNew) {
    return (
      <form className="flow-cfg" onSubmit={onSubmit}>
        <button type="button" className="pay-cfg-back" onClick={onCancel}>
          <Icon name="chevron-left" />
          Volver a flujos
        </button>
        <header className="pay-cfg-head">
          <div>
            <h1>Crear flujo</h1>
            <p>Define cómo debe atender el asistente y dónde lo utilizarás.</p>
          </div>
        </header>
        {error ? <p className="pay-cfg-error">{error}</p> : null}
        <div className="flow-cfg-board">
          <div className="flow-cfg-main">
            <section className="rule-block">
              <h2>1. Datos del flujo</h2>
              <label>
                <span>Nombre *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Reservas y visitas" />
              </label>
              <label>
                <span>Descripción</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Atiende consultas sobre experiencias, visitas y reservas."
                />
              </label>
            </section>
            <section className="rule-block">
              <h2>2. Instrucciones del asistente</h2>
              <label>
                <span>Qué debe hacer el bot *</span>
                <textarea
                  rows={5}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={CREATE_PROMPT}
                />
                <small>Escribe instrucciones internas sobre tono, comportamiento y límites.</small>
              </label>
            </section>
            <section className="rule-block">
              <h2>3. Canales y reglas</h2>
              <div className="flow-dual">
                <label>
                  <span>Canales</span>
                  {picker("channels")}
                </label>
                <label>
                  <span>Reglas del bot</span>
                  {picker("rules")}
                </label>
              </div>
              <label className="rule-check">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                <span>Usar como flujo predeterminado</span>
              </label>
            </section>
            <div className="flow-cfg-foot">
              <p>* Campos obligatorios</p>
              <div>
                <button type="button" className="btn ghost" onClick={onCancel}>
                  Cancelar
                </button>
                <button className="btn" disabled={saving}>
                  {saving ? "Creando…" : "Crear flujo"}
                </button>
              </div>
            </div>
          </div>
          <aside className="rule-try">
            <h2>Resumen del nuevo flujo</h2>
            <dl className="flow-summary">
              <div>
                <dt>Nombre</dt>
                <dd>{name.trim() || "Sin guardar"}</dd>
              </div>
              <div>
                <dt>Canales</dt>
                <dd>{channelIds.length ? `${channelIds.length} asignados` : "Sin asignar"}</dd>
              </div>
              <div>
                <dt>Reglas</dt>
                <dd>{ruleIds.length ? `${ruleIds.length} vinculadas` : "Sin vincular"}</dd>
              </div>
              <div>
                <dt>Predeterminado</dt>
                <dd>{isDefault ? "Sí" : "No"}</dd>
              </div>
            </dl>
            <div className="flow-after">
              <strong>Después de crearlo</strong>
              <ol>
                <li>Asigna los canales que lo utilizarán.</li>
                <li>Prueba su comportamiento antes de usarlo.</li>
              </ol>
            </div>
          </aside>
        </div>
      </form>
    );
  }

  return (
    <form className="flow-cfg" onSubmit={onSubmit}>
      <div className="rule-cfg-top">
        <button type="button" className="pay-cfg-back" onClick={onCancel}>
          <Icon name="chevron-left" />
          Volver a flujos
        </button>
        <div className="rule-cfg-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Descartar cambios
          </button>
          <button className="btn" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
      <header className="pay-cfg-head">
        <div>
          <h1>
            Editar flujo
            {isDefault ? <em className="flow-star">Predeterminado</em> : null}
          </h1>
          <p>Ajusta las instrucciones y las asignaciones de tu asistente.</p>
        </div>
      </header>
      {error ? <p className="pay-cfg-error">{error}</p> : null}
      <div className="flow-edit-fields">
        <label>
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          <span>Descripción</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="flow-tabs" role="tablist">
        {(
          [
            ["prompt", "Instrucciones", null],
            ["channels", "Canales", channelIds.length],
            ["rules", "Reglas", ruleIds.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "on" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {count != null ? <small>{count}</small> : null}
          </button>
        ))}
      </div>
      <div className="flow-cfg-board">
        <div>
          {tab === "prompt" ? (
            <section className="rule-block">
              <h2>Instrucciones del asistente</h2>
              <p className="flow-lead">Define su forma de atender, sus decisiones y sus límites.</p>
              <textarea rows={12} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
              <label className="rule-check">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                <span>Usar como flujo predeterminado</span>
              </label>
              {dirty ? <p className="flow-dirty">Cambios sin guardar</p> : null}
            </section>
          ) : null}
          {tab === "channels" ? (
            <section className="rule-block">
              <h2>Canales vinculados</h2>
              <p className="flow-lead">El asistente usa este flujo en los canales que marques.</p>
              {selectableChannels.map((ch) => (
                <label key={ch.id} className="rule-check">
                  <input
                    type="checkbox"
                    checked={channelIds.includes(ch.id)}
                    onChange={() => toggle(channelIds, ch.id, setChannelIds)}
                  />
                  <span>
                    {ch.name}
                    <small style={{ marginLeft: 8 }}>{channelMeta(ch.type).label}</small>
                  </span>
                </label>
              ))}
              {!selectableChannels.length ? <p className="muted">Aún no hay canales de WhatsApp.</p> : null}
            </section>
          ) : null}
          {tab === "rules" ? (
            <section className="rule-block">
              <h2>Reglas vinculadas</h2>
              <p className="flow-lead">Estas reglas solo se evalúan cuando el canal usa este flujo.</p>
              {rules.map((rule) => (
                <label key={rule.id} className="rule-check">
                  <input
                    type="checkbox"
                    checked={ruleIds.includes(rule.id)}
                    onChange={() => toggle(ruleIds, rule.id, setRuleIds)}
                  />
                  <span>{rule.name}</span>
                </label>
              ))}
              {!rules.length ? <p className="muted">Aún no hay reglas.</p> : null}
            </section>
          ) : null}
        </div>
        <aside className="rule-try">
          <h2>Configuración del flujo</h2>
          <ul className="flow-side-list">
            <li>
              <Icon name="share" />
              <div>
                <strong>Canales vinculados</strong>
                <p>{selectedChannels.length}</p>
              </div>
              <NavLink href="/channels">Gestionar canales</NavLink>
            </li>
            <li>
              <Icon name="file" />
              <div>
                <strong>Reglas vinculadas</strong>
                <p>{selectedRules.length}</p>
              </div>
              <NavLink href="/rules">Vincular reglas</NavLink>
            </li>
            <li>
              <Icon name="spark" />
              <div>
                <strong>Predeterminado</strong>
                <p>{isDefault ? "Sí" : "No"}</p>
              </div>
            </li>
          </ul>
          <div className="flow-try-box">
            <h3>Probar comportamiento</h3>
            <label>
              <span>Situación de prueba</span>
              <select
                value={scenario}
                onChange={(e) => {
                  const next = e.target.value as (typeof SCENARIOS)[number]["id"];
                  setScenario(next);
                  setExpected(simulateFlow(prompt, next));
                }}
              >
                {SCENARIOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn rule-try-btn" onClick={runTest}>
              <Icon name="play" />
              Probar flujo
            </button>
            <div className="rule-result-card">
              <span>
                <Icon name="chat" />
              </span>
              <div>
                <strong>Comportamiento esperado</strong>
                <p>{expected}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

export { emptyFlow };
