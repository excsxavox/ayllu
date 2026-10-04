"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { useAppPath } from "@/lib/app-path";
import { useMounted } from "@/lib/use-mounted";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { RuleConfig } from "./rule-config";
import {
  SAMPLES,
  actionLabel,
  emptyRule,
  iconOf,
  priorityOf,
  toPayload,
  warningOf,
  whenLabel,
  type RuleDraft,
} from "./model";

type Flow = { id: string; name: string; isDefault?: boolean };

function pad(index: number) {
  return String(index + 1).padStart(2, "0");
}

export default function RulesPage() {
  const mounted = useMounted();
  const { path, query: urlQuery, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<RuleDraft[]>("/rules");
  const { data: flows } = useApiGet<Flow[]>("/flows");
  const [searchText, setSearchText] = useState("");
  const [flowFilter, setFlowFilter] = useState("all");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [examples, setExamples] = useState(false);
  const [examplesTouched, setExamplesTouched] = useState(false);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const editKey = path === "/rules" ? urlQuery.get("edit") : null;
  const configuring = editKey != null;

  const source = useMemo(() => {
    const real = items ?? [];
    return examples ? [...real, ...SAMPLES] : real;
  }, [examples, items]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return source.filter((rule) => {
      if (flowFilter !== "all") {
        if (flowFilter === "none" && rule.flowId) return false;
        if (flowFilter !== "none" && rule.flowId !== flowFilter && rule.flow?.id !== flowFilter) return false;
      }
      if (!q) return true;
      return [rule.name, actionLabel(rule), whenLabel(rule), rule.flow?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [flowFilter, searchText, source]);

  const activeCount = source.filter((rule) => rule.enabled).length;

  useEffect(() => {
    if (examplesTouched || items === null) return;
    if (items.length === 0) setExamples(true);
  }, [examplesTouched, items]);

  useEffect(() => {
    if (!configuring) {
      setDraft(null);
      return;
    }
    if (editKey === "new") {
      setDraft((current) => (current && !current.id ? current : emptyRule()));
      return;
    }
    const sample = SAMPLES.find((rule) => rule.id === editKey);
    if (sample) {
      setDraft({ ...emptyRule(), ...sample, id: "", demo: false });
      return;
    }
    if (items === null) return;
    const found = items.find((rule) => rule.id === editKey);
    if (!found) {
      navigate("/rules");
      return;
    }
    setDraft((current) => (current?.id === found.id ? current : { ...found }));
  }, [configuring, editKey, items, navigate]);

  function openForm(rule?: RuleDraft) {
    if (rule?.demo) {
      setDraft({ ...emptyRule(), ...rule, id: "", demo: false });
      navigate("/rules?edit=new");
      return;
    }
    setDraft(rule ? { ...rule } : emptyRule());
    navigate(rule?.id ? `/rules?edit=${rule.id}` : "/rules?edit=new");
  }

  function closeForm() {
    setDraft(null);
    navigate("/rules");
  }

  async function toggleEnabled(rule: RuleDraft) {
    if (rule.demo) return;
    await api(`/rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify(toPayload({ ...rule, enabled: !rule.enabled })),
    });
    await reload();
  }

  if (!mounted) return <LoadingState label="Cargando reglas…" />;

  if (configuring) {
    if (!draft) return <LoadingState label="Cargando regla…" />;
    return (
      <RuleConfig
        key={draft.id || "new"}
        rule={draft}
        flows={flows ?? []}
        onCancel={closeForm}
        onSaved={() => {
          closeForm();
          void reload();
        }}
      />
    );
  }

  return (
    <div className="rule-page">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input
                type="checkbox"
                checked={examples}
                onChange={(e) => {
                  setExamplesTouched(true);
                  setExamples(e.target.checked);
                }}
              />
              <span>Datos de ejemplo</span>
            </label>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Nueva regla
            </button>
          </>
        }
      />

      <div className="rule-toolbar">
        <label className="pay-search">
          <Icon name="search" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar una regla…"
            aria-label="Buscar una regla"
          />
        </label>
        <select
          className="rule-flow-filter"
          value={flowFilter}
          onChange={(e) => setFlowFilter(e.target.value)}
          aria-label="Filtrar por flujo"
        >
          <option value="all">Todos los flujos</option>
          <option value="none">Sin flujo asignado</option>
          {(flows ?? []).map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
        <div className="rule-views" role="tablist" aria-label="Vista de reglas">
          <button type="button" role="tab" aria-selected={view === "cards"} className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>
            <Icon name="box" />
            Tarjetas
          </button>
          <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
            <Icon name="list" />
            Lista
          </button>
        </div>
      </div>

      {items === null && <LoadingState compact label="Cargando reglas…" />}

      {items && !filtered.length && (
        <EmptyState
          title={source.length ? "Sin coincidencias" : "Aún no hay reglas"}
          body={
            source.length
              ? "Prueba otro nombre o cambia el flujo."
              : "Crea una regla para decirle al asistente cuándo actuar y qué hacer."
          }
        />
      )}

      {filtered.length > 0 && (
        <>
          <p className="rule-count">
            {activeCount} regla{activeCount === 1 ? "" : "s"} activa{activeCount === 1 ? "" : "s"}
          </p>

          {view === "cards" ? (
            <div className="rule-grid">
              {filtered.map((rule, index) => (
                <article key={rule.id} className={`rule-card${rule.enabled ? "" : " is-off"}`}>
                  <header className="rule-card-top">
                    <span className="rule-grip" aria-hidden>
                      <Icon name="grip" />
                    </span>
                    <em>{pad(index)}</em>
                    <span className="rule-ico">
                      <Icon name={iconOf(rule)} />
                    </span>
                    <div>
                      <strong>
                        {rule.name}
                        {rule.demo ? <i>Ejemplo</i> : null}
                      </strong>
                      <p>
                        <span>{rule.flow?.name || "Todos los flujos"}</span>
                        <span>{priorityOf(rule.priority) === "alta" ? "Alta" : priorityOf(rule.priority) === "media" ? "Media" : "Baja"}</span>
                      </p>
                    </div>
                    <label className="rule-switch">
                      <button
                        type="button"
                        className="pay-switch"
                        role="switch"
                        aria-checked={rule.enabled}
                        disabled={rule.demo}
                        onClick={() => void toggleEnabled(rule)}
                      >
                        <i />
                      </button>
                      {rule.enabled ? "Activa" : "Inactiva"}
                    </label>
                  </header>

                  <div className="rule-pair">
                    <div>
                      <small>
                        <Icon name="user" />
                        Cuando
                      </small>
                      <p>{whenLabel(rule)}</p>
                    </div>
                    <span aria-hidden>
                      <Icon name="chevron-right" />
                    </span>
                    <div>
                      <small>
                        <Icon name="sliders" />
                        El bot debe
                      </small>
                      <p>{actionLabel(rule)}</p>
                    </div>
                  </div>

                  {warningOf(rule) ? <p className="rule-warn">{warningOf(rule)}</p> : <div className="rule-warn-spacer" />}

                  <footer>
                    <button type="button" className="rule-cfg-btn" onClick={() => openForm(rule)}>
                      <Icon name="pencil" />
                      Configurar
                    </button>
                    <button type="button" className="rule-try-link" onClick={() => openForm(rule)}>
                      <Icon name="play" />
                      Probar
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="reply-table-wrap">
              <table className="reply-table">
                <thead>
                  <tr>
                    <th>Regla</th>
                    <th>Cuando</th>
                    <th>El bot debe</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rule, index) => (
                    <tr key={rule.id} className={rule.enabled ? "" : "is-off"}>
                      <td>
                        <div className="reply-title">
                          <span className="reply-file">
                            <Icon name={iconOf(rule)} />
                          </span>
                          <div>
                            <strong>
                              {pad(index)} {rule.name}
                              {rule.demo ? <i>Ejemplo</i> : null}
                            </strong>
                            <p>
                              {rule.flow?.name || "Todos los flujos"} ·{" "}
                              {priorityOf(rule.priority) === "alta" ? "Alta" : priorityOf(rule.priority) === "media" ? "Media" : "Baja"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{whenLabel(rule)}</td>
                      <td>{actionLabel(rule)}</td>
                      <td>
                        <span className="svc-state">
                          <button
                            type="button"
                            className="pay-switch"
                            role="switch"
                            aria-checked={rule.enabled}
                            disabled={rule.demo}
                            onClick={() => void toggleEnabled(rule)}
                          >
                            <i />
                          </button>
                          {rule.enabled ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        <div className="reply-actions">
                          <button type="button" className="reply-edit" onClick={() => openForm(rule)}>
                            <Icon name="pencil" />
                            Configurar
                          </button>
                          <button type="button" className="icon-btn" aria-label={`Probar ${rule.name}`} onClick={() => openForm(rule)}>
                            <Icon name="play" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === "cards" ? <p className="rule-hint">Arrastra las tarjetas para reorganizarlas.</p> : null}
        </>
      )}
    </div>
  );
}
