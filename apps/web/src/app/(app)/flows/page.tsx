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
import { channelMeta } from "@/lib/channels";
import { FlowForm } from "./flow-form";
import { useConfirm } from "@/components/confirm-dialog";
import { SAMPLES, emptyFlow, promptLines, type FlowDraft } from "./model";

type Channel = { id: string; name: string; type: string; flowId?: string | null };
type Rule = { id: string; name: string; flowId?: string | null };

export default function FlowsPage() {
  const mounted = useMounted();
  const { path, query: urlQuery, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<FlowDraft[]>("/flows");
  const { data: channels } = useApiGet<Channel[]>("/channels");
  const { data: rules } = useApiGet<Rule[]>("/rules");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("all");
  const [examples, setExamples] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const { ask } = useConfirm();
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const editKey = path === "/flows" ? urlQuery.get("edit") : null;
  const configuring = editKey != null;

  const source = useMemo(() => {
    const real = (items ?? []).filter((flow) => !/redes|instagram|messenger/i.test(flow.name));
    return examples ? [...real, ...SAMPLES] : real;
  }, [examples, items]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return source.filter((flow) => {
      if (filter === "default" && !flow.isDefault) return false;
      if (filter === "other" && flow.isDefault) return false;
      if (!q) return true;
      return [flow.name, flow.description, flow.systemPrompt]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, searchText, source]);

  useEffect(() => {
    if (!configuring) {
      setDraft(null);
      return;
    }
    if (editKey === "new") {
      setDraft((current) => (current && !current.id ? current : emptyFlow()));
      return;
    }
    const sample = SAMPLES.find((flow) => flow.id === editKey);
    if (sample) {
      setDraft({ ...emptyFlow(), ...sample, id: "", demo: false, channels: [], rules: [] });
      return;
    }
    if (items === null) return;
    const found = items.find((flow) => flow.id === editKey);
    if (!found) {
      navigate("/flows");
      return;
    }
    setDraft((current) => (current?.id === found.id ? current : { ...found }));
  }, [configuring, editKey, items, navigate]);

  function openForm(flow?: FlowDraft) {
    setMenuId(null);
    if (flow?.demo) {
      setDraft({ ...emptyFlow(), ...flow, id: "", demo: false, channels: [], rules: [] });
      navigate("/flows?edit=new");
      return;
    }
    setDraft(flow ? { ...flow } : emptyFlow());
    navigate(flow?.id ? `/flows?edit=${flow.id}` : "/flows?edit=new");
  }

  function closeForm() {
    setDraft(null);
    navigate("/flows");
  }

  async function makeDefault(flow: FlowDraft) {
    if (flow.demo || flow.isDefault) return;
    await api(`/flows/${flow.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: flow.name,
        description: flow.description ?? null,
        systemPrompt: flow.systemPrompt ?? null,
        tone: flow.tone ?? null,
        replyMode: flow.replyMode,
        isDefault: true,
      }),
    });
    setMenuId(null);
    await reload();
  }

  async function remove(flow: FlowDraft) {
    if (flow.demo || flow.isDefault) return;
    const ok = await ask({
      title: `¿Borrar ${flow.name}?`,
      body: "El flujo se elimina. Los canales que lo usaban quedan sin ese ajuste.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    await api(`/flows/${flow.id}`, { method: "DELETE" });
    setMenuId(null);
    await reload();
  }

  if (!mounted) return <LoadingState label="Cargando flujos…" />;

  if (configuring) {
    if (!draft) return <LoadingState label="Cargando flujo…" />;
    return (
      <FlowForm
        key={draft.id || "new"}
        flow={draft}
        channels={channels ?? []}
        rules={rules ?? []}
        onCancel={closeForm}
        onSaved={() => {
          closeForm();
          void reload();
        }}
      />
    );
  }

  return (
    <div className="flow-page">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
              <span>Datos de ejemplo</span>
            </label>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Crear flujo
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
            placeholder="Buscar un flujo…"
            aria-label="Buscar un flujo"
          />
        </label>
        <select className="rule-flow-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar flujos">
          <option value="all">Todos los flujos</option>
          <option value="default">Predeterminado</option>
          <option value="other">Otros</option>
        </select>
        <p className="rule-count" style={{ margin: 0, marginLeft: "auto" }}>
          {filtered.length} flujo{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {items === null && <LoadingState compact label="Cargando flujos…" />}
      {items && !filtered.length && (
        <EmptyState
          title={source.length ? "Sin coincidencias" : "Aún no hay flujos"}
          body={source.length ? "Prueba otro nombre o cambia el filtro." : "Crea un flujo para decirle al asistente cómo atender."}
        />
      )}

      {filtered.length > 0 && (
        <div className="flow-list">
          {filtered.map((flow) => {
            const lines = promptLines(flow.systemPrompt).slice(0, 3);
            const waChannels = (flow.channels ?? []).filter((ch) => ch.type === "WHATSAPP");
            const chCount = flow.channels ? waChannels.length : (flow._count?.channels ?? 0);
            const ruleCount = flow._count?.rules ?? flow.rules?.length ?? 0;
            return (
              <article key={flow.id} className={`flow-card${flow.isDefault ? " is-default" : ""}`}>
                <header>
                  <span className="rule-ico">
                    <Icon name="share" />
                  </span>
                  <div>
                    <strong>
                      {flow.name}
                      {flow.isDefault ? <em>Predeterminado</em> : null}
                      {flow.demo ? <i>Ejemplo</i> : null}
                    </strong>
                    <p>{flow.description || "Sin descripción"}</p>
                  </div>
                  <div className="flow-card-right">
                  <div className="flow-card-meta">
                    <span>
                      <Icon name="radio" />
                      {chCount} canal{chCount === 1 ? "" : "es"}
                    </span>
                    <span>
                      <Icon name="sliders" />
                      {ruleCount} regla{ruleCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flow-card-actions">
                    <button type="button" className="rule-cfg-btn" onClick={() => openForm(flow)}>
                      <Icon name="pencil" />
                      Editar flujo
                    </button>
                    <button type="button" className="rule-try-link" onClick={() => openForm(flow)}>
                      <Icon name="play" />
                      Probar
                    </button>
                    {!flow.demo ? (
                      <div className="catalog-more">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Más acciones de ${flow.name}`}
                          onClick={() => setMenuId((id) => (id === flow.id ? null : flow.id))}
                        >
                          <Icon name="more" />
                        </button>
                        {menuId === flow.id ? (
                          <div className="inbox-pop">
                            {!flow.isDefault ? (
                              <button type="button" onClick={() => void makeDefault(flow)}>
                                Establecer como predeterminado
                              </button>
                            ) : null}
                            <button type="button" onClick={() => openForm(flow)}>
                              Editar
                            </button>
                            {!flow.isDefault ? (
                              <button type="button" onClick={() => void remove(flow)}>
                                Borrar
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </header>

                {flow.isDefault && lines.length ? (
                  <div className="flow-preview">
                    <h3>Instrucciones del asistente</h3>
                    <ul>
                      {lines.map((line) => (
                        <li key={line}>
                          <Icon name="check-circle" />
                          {line}
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="flow-more" onClick={() => openForm(flow)}>
                      Ver instrucciones completas
                      <Icon name="chevron-right" />
                    </button>
                  </div>
                ) : (
                  <div className="flow-card-foot">
                    {waChannels.length ? (
                      <div className="flow-chips">
                        {waChannels.map((ch) => (
                          <span key={ch.id} style={{ color: channelMeta(ch.type).color, background: channelMeta(ch.type).bg }}>
                            {channelMeta(ch.type).label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    {!flow.isDefault && !flow.demo ? (
                      <button type="button" className="flow-set" onClick={() => void makeDefault(flow)}>
                        Establecer como predeterminado
                      </button>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
          <p className="rule-hint">El flujo predeterminado está destacado para encontrarlo rápido.</p>
          <p className="rule-hint">Mostrando {filtered.length} flujo{filtered.length === 1 ? "" : "s"}</p>
        </div>
      )}
    </div>
  );
}
