"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/icons";
import {
  FALLBACK_OPTIONS,
  PRIORITIES,
  REQUEST_OPTIONS,
  WHEN_OPTIONS,
  actionLabel,
  emptyRule,
  instructionPlaceholder,
  priorityOf,
  priorityValue,
  toPayload,
  warningOf,
  whenOf,
  type FallbackId,
  type Priority,
  type RuleDraft,
  type WhenId,
} from "./model";

type Flow = { id: string; name: string };

type SimResult = {
  applies: boolean;
  title: string;
  detail: string;
  limit: string;
  alternative: string;
};

function simulate(draft: RuleDraft, request: WhenId, availability: string): SimResult {
  const when = whenOf(draft);
  const applies = when === request || when === "unresolved";
  if (!applies) {
    return {
      applies: false,
      title: "Esta regla no entra",
      detail: "El tipo de solicitud no coincide con la condición configurada.",
      limit: "",
      alternative: "",
    };
  }
  const verifiedBlocked = Boolean(draft.actions.requireVerified) && availability !== "verified";
  return {
    applies: true,
    title: actionLabel(draft).split(".")[0] || "Seguir la instrucción",
    detail:
      when === "reserve"
        ? "Verificar fecha y servicio antes de continuar."
        : when === "addon"
          ? "Ofrecerlo solo si hay stock junto al servicio principal."
          : when === "prices"
            ? "Responder con los datos vigentes, sin inventar."
            : when === "unresolved" || when === "group" || when === "handover"
              ? "Pasar el caso a una persona del equipo."
              : "Aplicar la instrucción interna de la regla.",
    limit: verifiedBlocked ? warningOf(draft) || "No confirmar la reserva todavía." : "",
    alternative:
      draft.actions.fallback === "human" || draft.actions.transferToHuman
        ? "Derivar a una persona"
        : "",
  };
}

export function RuleConfig({
  rule,
  flows,
  onCancel,
  onSaved,
}: {
  rule: RuleDraft;
  flows: Flow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule.name);
  const [priority, setPriority] = useState<Priority>(priorityOf(rule.priority));
  const [enabled, setEnabled] = useState(rule.enabled);
  const [when, setWhen] = useState<WhenId>(whenOf(rule));
  const [flowId, setFlowId] = useState(rule.flowId ?? "");
  const [keywords, setKeywords] = useState(((rule.conditions.keywords as string[]) ?? []).join(", "));
  const [minGuests, setMinGuests] = useState(String(Number(rule.conditions.minGuests) || 12));
  const [startTime, setStartTime] = useState(String(rule.conditions.startTime || "09:00"));
  const [endTime, setEndTime] = useState(String(rule.conditions.endTime || "19:00"));
  const [showKeywords, setShowKeywords] = useState(
    when === "keyword" || when === "handover" || Boolean((rule.conditions.keywords as string[] | undefined)?.length),
  );
  const [instruction, setInstruction] = useState(String(rule.actions.reply ?? ""));
  const [requireVerified, setRequireVerified] = useState(Boolean(rule.actions.requireVerified));
  const [fallback, setFallback] = useState<FallbackId>(
    rule.actions.fallback === "human" || rule.actions.transferToHuman ? "human" : "none",
  );
  const [request, setRequest] = useState<WhenId>(whenOf(rule) === "keyword" ? "reserve" : whenOf(rule));
  const [availability, setAvailability] = useState("unverified");
  const [result, setResult] = useState<SimResult | null>(() =>
    simulate(
      {
        ...rule,
        conditions: { ...rule.conditions, when: whenOf(rule) },
      },
      whenOf(rule) === "keyword" ? "reserve" : whenOf(rule),
      "unverified",
    ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !rule.id;

  const draft = useMemo<RuleDraft>(
    () => ({
      ...emptyRule(),
      ...rule,
      name,
      priority: priorityValue(priority),
      enabled,
      flowId: flowId || null,
      conditions: {
        ...rule.conditions,
        when,
        keywords: keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        minGuests: Number(minGuests) || 12,
        startTime,
        endTime,
      },
      actions: {
        ...rule.actions,
        reply: instruction,
        requireVerified,
        fallback,
        transferToHuman: fallback === "human",
      },
    }),
    [enabled, endTime, fallback, flowId, instruction, keywords, minGuests, name, priority, requireVerified, rule, startTime, when],
  );

  function runSimulate() {
    setResult(simulate(draft, request, availability));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Ponle un nombre a la regla.");
      return;
    }
    setSaving(true);
    setError("");
    const body = toPayload(draft);
    try {
      if (rule.id) await api(`/rules/${rule.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/rules", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la regla.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rule-cfg" onSubmit={onSubmit}>
      <div className="rule-cfg-top">
        <button type="button" className="pay-cfg-back" onClick={onCancel}>
          <Icon name="chevron-left" />
          Volver a reglas
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
          <h1>{isNew ? "Nueva regla" : "Configurar regla"}</h1>
          <p>Establece cuándo aplica, qué debe hacer el bot y cómo actuar si no puede cumplirla.</p>
        </div>
      </header>

      {error ? <p className="pay-cfg-error">{error}</p> : null}

      <div className="rule-cfg-board">
        <div className="rule-cfg-main">
          <section className="rule-block">
            <div className="rule-block-head">
              <span className="rule-step-ico">
                <Icon name="file" />
              </span>
              <div>
                <h2>Información general</h2>
              </div>
            </div>
            <div className="rule-fields">
              <label>
                <span>Nombre</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Verificar disponibilidad" />
              </label>
              <label>
                <span>Prioridad</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rule-active">
                <span>Activa</span>
                <button
                  type="button"
                  className="pay-switch"
                  role="switch"
                  aria-checked={enabled}
                  aria-label="Activar regla"
                  onClick={() => setEnabled((v) => !v)}
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
                <Icon name="share" />
              </span>
              <div>
                <h2>Cuándo aplica</h2>
                <p>Define en qué situación se activará esta regla.</p>
              </div>
            </div>
            <div className="rule-fields">
              <label>
                <span>Condición</span>
                <select
                  value={when}
                  onChange={(e) => {
                    const next = e.target.value as WhenId;
                    const option = WHEN_OPTIONS.find((item) => item.id === next);
                    setWhen(next);
                    setShowKeywords(next === "keyword" || next === "handover" || next === "reserve" || next === "addon" || next === "prices");
                    if (option?.keywords) setKeywords(option.keywords.join(", "));
                    if (next === "group") {
                      setFallback("human");
                      if (!instruction.trim()) setInstruction(instructionPlaceholder("group"));
                    }
                    if (next === "handover") setFallback("human");
                  }}
                >
                  {WHEN_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Alcance</span>
                <select value={flowId} onChange={(e) => setFlowId(e.target.value)}>
                  <option value="">Todos los flujos</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {when === "group" ? (
              <label className="rule-extra">
                <span>Desde cuántas personas</span>
                <input type="number" min={2} max={200} value={minGuests} onChange={(e) => setMinGuests(e.target.value)} />
              </label>
            ) : null}
            {when === "hours" ? (
              <div className="rule-fields rule-extra">
                <label>
                  <span>Abre</span>
                  <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="09:00" />
                </label>
                <label>
                  <span>Cierra</span>
                  <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="19:00" />
                </label>
              </div>
            ) : null}
            {showKeywords ? (
              <label className="rule-extra">
                <span>Palabras clave</span>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="reservar, agendar, cita"
                />
              </label>
            ) : when !== "group" && when !== "hours" && when !== "greeting" ? (
              <button type="button" className="rule-add" onClick={() => setShowKeywords(true)}>
                <Icon name="plus" />
                Agregar condición
              </button>
            ) : null}
          </section>

          <section className="rule-block">
            <div className="rule-block-head">
              <span className="rule-num">2</span>
              <span className="rule-step-ico">
                <Icon name="bot" />
              </span>
              <div>
                <h2>Qué debe hacer el bot</h2>
                <p>Indica la instrucción interna que debe seguir el asistente.</p>
              </div>
            </div>
            <label>
              <span>Instrucción interna</span>
              <textarea
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={instructionPlaceholder(when)}
              />
            </label>
            <label className="rule-check">
              <input type="checkbox" checked={requireVerified} onChange={(e) => setRequireVerified(e.target.checked)} />
              <span>No confirmar si la disponibilidad no está verificada</span>
            </label>
          </section>

          <section className="rule-block">
            <div className="rule-block-head">
              <span className="rule-num">3</span>
              <span className="rule-step-ico">
                <Icon name="user" />
              </span>
              <div>
                <h2>Si no puede cumplirla</h2>
                <p>Define qué hacer cuando no es posible seguir la instrucción.</p>
              </div>
            </div>
            <label>
              <span>Acción alternativa</span>
              <select value={fallback} onChange={(e) => setFallback(e.target.value as FallbackId)}>
                {FALLBACK_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <small>Si la agenda no responde o la información es insuficiente.</small>
            </label>
            {fallback === "human" ? (
              <p className="rule-human">
                <Icon name="spark" />
                Requiere atención humana
              </p>
            ) : null}
          </section>
        </div>

        <aside className="rule-try">
          <div className="rule-try-head">
            <span className="rule-step-ico play">
              <Icon name="play" />
            </span>
            <div>
              <h2>Probar comportamiento</h2>
              <p>Simula una situación sin contactar al cliente.</p>
            </div>
          </div>
          <label>
            <span>Tipo de solicitud</span>
            <select value={request} onChange={(e) => setRequest(e.target.value as WhenId)}>
              {REQUEST_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Disponibilidad</span>
            <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="unverified">Sin verificar</option>
              <option value="verified">Verificada</option>
              <option value="full">Sin cupo</option>
            </select>
          </label>
          <button type="button" className="btn rule-try-btn" onClick={runSimulate}>
            <Icon name="play" />
            Simular decisión
          </button>

          {result ? (
            <div className="rule-result">
              <h3>Resultado esperado</h3>
              {result.applies ? (
                <article className="rule-result-card">
                  <span>
                    <Icon name="calendar" />
                  </span>
                  <div>
                    <strong>{result.title}</strong>
                    <p>{result.detail}</p>
                  </div>
                </article>
              ) : (
                <p className="rule-result-empty">{result.detail}</p>
              )}
              {result.limit ? (
                <article className="rule-result-card warn">
                  <span>
                    <Icon name="bell" />
                  </span>
                  <div>
                    <strong>Límite de la regla</strong>
                    <p>{result.limit}</p>
                  </div>
                </article>
              ) : null}
              {result.alternative ? (
                <article className="rule-result-card alt">
                  <span>
                    <Icon name="user" />
                  </span>
                  <div>
                    <strong>Alternativa</strong>
                    <p>{result.alternative}</p>
                  </div>
                </article>
              ) : null}
            </div>
          ) : (
            <p className="rule-result-empty">Elige un escenario y simula para ver qué haría el asistente.</p>
          )}
        </aside>
      </div>
    </form>
  );
}
