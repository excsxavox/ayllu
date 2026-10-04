"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { useMounted } from "@/lib/use-mounted";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { BrandMark, Icon } from "@/components/icons";
import { useAppPath } from "@/lib/app-path";
import { useConfirm } from "@/components/confirm-dialog";
import { buildGraph, layoutGraph, matchesQuery, sampleGraph, type KnowNode } from "./graph";

type Doc = { id: string; title: string; content: string; sourceType: string; _count?: { chunks: number } };
type Service = { id: string; name: string; description?: string | null; isActive: boolean };
type Company = { name?: string; bookingsEnabled?: boolean };

const TYPES = [
  { id: "FAQ", label: "Preguntas frecuentes" },
  { id: "MANUAL", label: "Manual interno" },
] as const;

export default function KnowledgePage() {
  const mounted = useMounted();
  const { navigate } = useAppPath();
  const { data: docs, reload } = useApiGet<Doc[]>("/knowledge");
  const { data: services } = useApiGet<Service[]>("/services");
  const { data: company } = useApiGet<Company>("/companies/current");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [examples, setExamples] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { ask } = useConfirm();
  const [showLinks, setShowLinks] = useState(false);

  const companyName = company?.name || "Ayllu";
  const graph = useMemo(
    () =>
      examples
        ? sampleGraph(companyName)
        : buildGraph(docs, services, companyName, company?.bookingsEnabled),
    [company?.bookingsEnabled, companyName, docs, examples, services],
  );
  const pos = useMemo(() => layoutGraph(graph), [graph]);
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const q = search.trim();
  const visibleIds = useMemo(() => new Set(graph.nodes.filter((n) => matchesQuery(n, q)).map((n) => n.id)), [graph, q]);

  useEffect(() => {
    if (examples) setSelectedId("faq");
  }, [examples]);

  function pick(node: KnowNode) {
    setSelectedId(node.id);
    setAdding(false);
    setEditing(false);
    setShowLinks(false);
  }

  async function saveDoc(e: FormEvent<HTMLFormElement>, docId?: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      title: String(form.get("title") || "").trim(),
      content: String(form.get("content") || "").trim(),
      sourceType: String(form.get("sourceType") || "FAQ"),
    };
    if (docId) await api(`/knowledge/${docId}`, { method: "PATCH", body: JSON.stringify(body) });
    else await api("/knowledge", { method: "POST", body: JSON.stringify(body) });
    setAdding(false);
    setEditing(false);
    await reload();
  }

  async function removeDoc(id: string, title: string) {
    const ok = await ask({
      title: `¿Quitar ${title}?`,
      body: "El asistente deja de usar este documento para responder.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    await api(`/knowledge/${id}`, { method: "DELETE" });
    setSelectedId(null);
    await reload();
  }

  if (!mounted || docs === null) return <LoadingState label="Cargando conocimiento…" />;

  return (
    <div className="know-page">
      <PageHeader
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setAdding(true);
                setDraftTitle("");
                setEditing(false);
                setSelectedId(null);
                setView("graph");
              }}
            >
              <Icon name="plus" />
              Agregar conocimiento
            </button>
            <label className="pay-example">
              <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
              <span>Vista de ejemplo</span>
            </label>
          </>
        }
      />

      <div className={`know-board${selected || adding ? " has-side" : ""}`}>
        <section className="know-main">
          <div className="know-toolbar">
            <label className="pay-search">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar un tema o documento…"
                aria-label="Buscar un tema o documento"
              />
            </label>
            <div className="pay-filters" role="tablist" aria-label="Vista">
              <button type="button" role="tab" aria-selected={view === "graph"} className={view === "graph" ? "on" : ""} onClick={() => setView("graph")}>
                <Icon name="radio" />
                Red
              </button>
              <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                <Icon name="list" />
                Lista
              </button>
            </div>
          </div>

          {view === "list" ? (
            <div className="know-list">
              {!graph.nodes.some((n) => n.kind !== "hub") ? (
                <EmptyState title="Sin conocimiento" body="Agrega un documento para que el asistente tenga de dónde responder." />
              ) : (
                graph.nodes
                  .filter((n) => n.kind !== "hub" && matchesQuery(n, q))
                  .map((node) => (
                    <button key={node.id} type="button" className={`know-list-item${selectedId === node.id ? " on" : ""}`} onClick={() => pick(node)}>
                      <span className={`know-ico ${node.kind}`}>
                        <Icon name={node.icon} />
                      </span>
                      <span>
                        <strong>{node.label}</strong>
                        <small>{node.kind === "topic" ? "Tema" : node.sourceType === "MANUAL" ? "Manual" : "Documento"}</small>
                      </span>
                    </button>
                  ))
              )}
            </div>
          ) : (
            <div className="know-canvas">
              <div className="know-scene" style={{ transform: `scale(${zoom})` }}>
                <svg className="know-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {graph.edges.map((edge) => {
                    const a = pos[edge.from];
                    const b = pos[edge.to];
                    if (!a || !b) return null;
                    const on = !q || visibleIds.has(edge.from) || visibleIds.has(edge.to);
                    const linked = showLinks && selected && (edge.from === selected.id || edge.to === selected.id);
                    return (
                      <path
                        key={`${edge.from}-${edge.to}`}
                        d={curve(a, b)}
                        className={`know-edge${on ? "" : " dim"}${linked ? " on" : ""}`}
                      />
                    );
                  })}
                </svg>
                {graph.nodes.map((node) => {
                  const p = pos[node.id];
                  if (!p) return null;
                  const dim = Boolean(q) && !visibleIds.has(node.id);
                  const leaf = node.kind !== "hub" && node.parentId !== "hub";
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`know-node ${node.kind}${leaf ? " leaf" : ""}${selectedId === node.id ? " on" : ""}${dim ? " dim" : ""}`}
                      style={{ left: `${p.x}%`, top: `${p.y}%` }}
                      onClick={() => pick(node)}
                    >
                      <span className="know-ico">
                        {node.kind === "hub" ? <BrandMark /> : <Icon name={node.icon} />}
                      </span>
                      <strong>{node.label}</strong>
                    </button>
                  );
                })}
              </div>
              <footer className="know-canvas-foot">
                <div className="know-legend">
                  <span>
                    <i className="hub" />
                    Asistente
                  </span>
                  <span>
                    <i className="topic" />
                    Tema
                  </span>
                  <span>
                    <i className="doc" />
                    Documento
                  </span>
                </div>
                <p>Selecciona un nodo para ver su contenido.</p>
                <div className="know-zoom">
                  <button type="button" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}>
                    <Icon name="minus" />
                  </button>
                  <em>{Math.round(zoom * 100)}%</em>
                  <button type="button" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))}>
                    <Icon name="plus" />
                  </button>
                </div>
              </footer>
            </div>
          )}
        </section>

        <aside className="know-side">
          {adding || (editing && selected?.docId) ? (
            <DocForm
              key={editing ? selected?.docId : `new-${draftTitle}`}
              title={editing ? selected?.label : draftTitle}
              content={editing ? selected?.content : ""}
              sourceType={editing ? selected?.sourceType : "FAQ"}
              onCancel={() => {
                setAdding(false);
                setEditing(false);
                setDraftTitle("");
              }}
              onSubmit={(e) => void saveDoc(e, editing ? selected?.docId : undefined)}
            />
          ) : selected ? (
            <Inspector
              node={selected}
              childrenLabels={graph.nodes.filter((n) => n.parentId === selected.id).map((n) => n.label)}
              companyName={companyName}
              onClose={() => setSelectedId(null)}
              onEdit={() => {
                if (selected.catalogId) {
                  navigate(`/services?edit=${selected.catalogId}`);
                  return;
                }
                if (selected.docId) setEditing(true);
                else {
                  setDraftTitle(selected.kind === "topic" ? "" : selected.label);
                  setAdding(true);
                }
              }}
              onLinks={() => setShowLinks((v) => !v)}
              onDelete={selected.docId ? () => void removeDoc(selected.docId as string, selected.label) : undefined}
              linksOn={showLinks}
            />
          ) : (
            <div className="know-empty-side">
              <span className="know-ico topic">
                <Icon name="book" />
              </span>
              <strong>Documento seleccionado</strong>
              <p>Elige un nodo de la red para leer lo que el asistente puede usar.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Inspector({
  node,
  childrenLabels,
  companyName,
  onClose,
  onEdit,
  onLinks,
  onDelete,
  linksOn,
}: {
  node: KnowNode;
  childrenLabels: string[];
  companyName: string;
  onClose: () => void;
  onEdit: () => void;
  onLinks: () => void;
  onDelete?: () => void;
  linksOn: boolean;
}) {
  const kind = node.catalogId
    ? "Servicio del catálogo"
    : node.kind === "hub"
      ? "Asistente"
      : node.kind === "topic"
        ? "Tema"
        : node.sourceType === "MANUAL"
          ? "Manual interno"
          : "Preguntas frecuentes";
  const body =
    node.kind === "hub"
      ? `El asistente de ${companyName} responde con estos temas. Abre un documento para ver el texto que usa.`
      : node.kind === "topic"
        ? childrenLabels.length
          ? `Agrupa: ${childrenLabels.join(", ")}.`
          : "Este tema agrupa documentos. Agrega uno por cada pregunta."
        : node.content || "Aún no hay texto para este nodo.";
  const action = node.catalogId
    ? "Editar en Servicios"
    : node.docId
      ? "Editar documento"
      : "Agregar documento";
  return (
    <>
      <header>
        <p>{node.kind === "hub" ? "Asistente" : node.kind === "topic" ? "Tema seleccionado" : "Documento seleccionado"}</p>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="know-doc-head">
        <span className={`know-ico ${node.kind === "hub" ? "hub" : "doc"}`}>
          {node.kind === "hub" ? <BrandMark /> : <Icon name={node.icon} />}
        </span>
        <div>
          <strong>{node.kind === "hub" ? `Asistente ${companyName}` : node.label}</strong>
          <small>
            <i />
            {node.catalogId ? "Viene del catálogo" : "Disponible"}
          </small>
        </div>
      </div>
      <div className="know-field">
        <span>Tipo</span>
        <p>{kind}</p>
      </div>
      <div className="know-field">
        <span>{node.catalogId ? "Lo que ofrece el servicio" : "Contenido para el asistente"}</span>
        <div className="know-body">{body}</div>
      </div>
      {node.related?.length ? (
        <div className="know-field">
          <span>Temas relacionados</span>
          <div className="know-related">
            {node.related.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="know-side-actions">
        {node.kind !== "hub" ? (
          <button type="button" className="btn" onClick={onEdit}>
            <Icon name="pencil" />
            {action}
          </button>
        ) : null}
        <button type="button" className={`btn ghost${linksOn ? " on" : ""}`} onClick={onLinks}>
          <Icon name="share" />
          Ver conexiones
        </button>
        {onDelete ? (
          <button type="button" className="know-forget" onClick={onDelete}>
            Quitar documento
          </button>
        ) : null}
      </div>
    </>
  );
}

function DocForm({
  title,
  content,
  sourceType,
  onCancel,
  onSubmit,
}: {
  title?: string;
  content?: string;
  sourceType?: string;
  onCancel: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const [type, setType] = useState(sourceType || "FAQ");
  return (
    <form className="know-form" onSubmit={onSubmit}>
      <header>
        <p>{title ? "Editar documento" : "Agregar conocimiento"}</p>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onCancel}>
          <Icon name="close" />
        </button>
      </header>
      <label>
        <span>Título *</span>
        <input name="title" required defaultValue={title} placeholder="Horario" />
      </label>
      <div className="know-field">
        <span>Tipo</span>
        <input type="hidden" name="sourceType" value={type} />
        <div className="know-types" role="radiogroup" aria-label="Tipo de documento">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={type === t.id ? "on" : ""}
              aria-pressed={type === t.id}
              onClick={() => setType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <small className="reply-cfg-hint">Preguntas frecuentes las usa el cliente. El manual es solo para el equipo.</small>
      </div>
      <label>
        <span>Contenido para el asistente *</span>
        <textarea
          name="content"
          required
          rows={8}
          defaultValue={content}
          placeholder="Solo este tema. Si preguntan otra cosa, crea otro documento."
        />
        <small className="reply-cfg-hint">Un tema por documento: horario, entrada, acampar, grupos. Así el asistente no suelta todo de una.</small>
      </label>
      <div className="know-side-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn">Guardar e indexar</button>
      </div>
    </form>
  );
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * 6;
  const cy = my + (dx / len) * 6;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}
