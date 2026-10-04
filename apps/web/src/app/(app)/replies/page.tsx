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
import { useConfirm } from "@/components/confirm-dialog";
import { ReplyConfig, type ReplyDraft } from "./reply-config";

type Reply = ReplyDraft & { demo?: boolean };

type Company = { id: string; replyMode?: string; name?: string };

const SAMPLES: Reply[] = [
  {
    id: "demo-precios",
    title: "Precios",
    body: "Te comparto nuestros precios vigentes.",
    shortcut: "/precios",
    keywords: ["precio", "costo"],
    isActive: true,
    demo: true,
  },
  {
    id: "demo-horarios",
    title: "Horarios",
    body: "Conoce nuestro horario de atención.",
    shortcut: "/horarios",
    keywords: ["horario", "atención"],
    isActive: true,
    demo: true,
  },
  {
    id: "demo-ubicacion",
    title: "Ubicación",
    body: "Te comparto la ubicación de nuestro local.",
    shortcut: "/ubicacion",
    keywords: ["dirección", "ubicación"],
    isActive: true,
    demo: true,
  },
  {
    id: "demo-pagos",
    title: "Formas de pago",
    body: "Estas son nuestras opciones de pago.",
    shortcut: "/pagos",
    keywords: ["pago", "transferencia"],
    isActive: true,
    demo: true,
  },
  {
    id: "demo-hola",
    title: "Bienvenida",
    body: "¡Hola! Gracias por escribir a Ayllu.",
    shortcut: "/hola",
    keywords: ["hola", "bienvenida"],
    isActive: false,
    demo: true,
  },
];

const MODES = [
  { id: "AUTO", label: "Automático", hint: "El bot responde las conversaciones" },
  { id: "HYBRID", label: "Híbrido", hint: "El bot responde y avisa al equipo" },
  { id: "MANUAL", label: "Manual", hint: "Un asesor escribe la respuesta" },
] as const;

function emptyDraft(): Reply {
  return { id: "", title: "", body: "", shortcut: "", keywords: [], isActive: true };
}

function shortcutOf(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw.replace(/^\//, "")}`;
}

export default function RepliesPage() {
  const mounted = useMounted();
  const { path, query: urlQuery, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<Reply[]>("/replies");
  const { data: company, reload: reloadCompany } = useApiGet<Company>("/companies/current");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const { ask } = useConfirm();
  const [examples, setExamples] = useState(false);
  const [draft, setDraft] = useState<Reply | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const editKey = path === "/replies" ? urlQuery.get("edit") : null;
  const configuring = editKey != null;

  const mode = MODES.find((item) => item.id === (company?.replyMode ?? "AUTO")) ?? MODES[0];
  const source = useMemo(() => {
    const real = items ?? [];
    return examples ? [...real, ...SAMPLES] : real;
  }, [examples, items]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return source.filter((reply) => {
      if (filter === "active" && !reply.isActive) return false;
      if (filter === "inactive" && reply.isActive) return false;
      if (!q) return true;
      return [reply.title, reply.body, reply.shortcut, ...reply.keywords]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, searchText, source]);

  const counts = useMemo(
    () => ({
      all: source.length,
      active: source.filter((r) => r.isActive).length,
      inactive: source.filter((r) => !r.isActive).length,
    }),
    [source],
  );

  useEffect(() => {
    if (!configuring) {
      setDraft(null);
      return;
    }
    if (editKey === "new") {
      setDraft((current) => (current && !current.id ? current : emptyDraft()));
      return;
    }
    if (items === null) return;
    const found = items.find((reply) => reply.id === editKey);
    if (!found) {
      navigate("/replies");
      return;
    }
    setDraft((current) => (current?.id === found.id ? current : { ...found }));
  }, [configuring, editKey, items, navigate]);

  function openForm(reply?: Reply) {
    setMenuId(null);
    if (reply?.demo) {
      setDraft({ ...emptyDraft(), ...reply, id: "", demo: false });
      navigate("/replies?edit=new");
      return;
    }
    setDraft(reply ? { ...reply, shortcut: shortcutOf(reply.shortcut) } : emptyDraft());
    navigate(reply?.id ? `/replies?edit=${reply.id}` : "/replies?edit=new");
  }

  function closeForm() {
    setDraft(null);
    navigate("/replies");
  }

  async function saveMode(next: string) {
    if (!company?.id) return;
    setModeOpen(false);
    await api(`/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify({ replyMode: next }),
    });
    await reloadCompany();
  }

  async function toggleActive(reply: Reply) {
    if (reply.demo) return;
    await api(`/replies/${reply.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...reply, isActive: !reply.isActive }),
    });
    await reload();
  }

  async function remove(reply: Reply) {
    if (reply.demo) return;
    const ok = await ask({
      title: `¿Quitar ${reply.title}?`,
      body: "El atajo deja de estar disponible en la bandeja.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    await api(`/replies/${reply.id}`, { method: "DELETE" });
    setMenuId(null);
    await reload();
  }

  if (!mounted) return <LoadingState label="Cargando respuestas…" />;

  if (configuring) {
    if (!draft) return <LoadingState label="Cargando respuesta…" />;
    return (
      <ReplyConfig
        key={draft.id || "new"}
        reply={draft}
        companyName={company?.name}
        onCancel={closeForm}
        onSaved={() => {
          closeForm();
          void reload();
        }}
      />
    );
  }

  return (
    <div className="reply-page">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
              <span>Datos de ejemplo</span>
            </label>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Nueva respuesta
            </button>
          </>
        }
      />

      <section className="reply-mode">
        <span className="reply-mode-ico">
          <Icon name="bot" />
        </span>
        <div>
          <strong>Quién responde</strong>
          <p>Modo de atención de la empresa</p>
        </div>
        <em>{mode.label}</em>
        <span>{mode.hint}</span>
        <div className="reply-mode-actions">
          <button type="button" className="btn ghost" onClick={() => setModeOpen((v) => !v)}>
            Cambiar modo
          </button>
          {modeOpen ? (
            <div className="inbox-pop">
              {MODES.map((item) => (
                <button key={item.id} type="button" className={item.id === mode.id ? "on" : ""} onClick={() => void saveMode(item.id)}>
                  <b>{item.label}</b>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="reply-toolbar">
        <label className="pay-search">
          <Icon name="search" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar por título, atajo o palabra clave…"
            aria-label="Buscar respuestas"
          />
        </label>
        <div className="pay-filters" role="tablist" aria-label="Filtrar respuestas">
          {(
            [
              ["all", "Todas", counts.all],
              ["active", "Activas", counts.active],
              ["inactive", "Inactivas", counts.inactive],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? "on" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
              <small>{count}</small>
            </button>
          ))}
        </div>
      </div>

      {items === null && <LoadingState compact label="Cargando plantillas…" />}
      {items && !filtered.length && (
        <EmptyState
          title={source.length ? "Sin coincidencias" : "Aún no hay respuestas"}
          body={
            source.length
              ? "Prueba otro título, atajo o cambia el filtro."
              : "Crea textos listos. En la bandeja escribe / para insertarlos."
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="reply-table-wrap">
          <table className="reply-table">
            <thead>
              <tr>
                <th>Respuesta</th>
                <th>Atajo</th>
                <th>Palabras clave</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((reply) => (
                <tr key={reply.id} className={reply.isActive ? "" : "is-off"}>
                  <td>
                    <div className="reply-title">
                      <span className="reply-file">
                        <Icon name="file" />
                      </span>
                      <div>
                        <strong>
                          {reply.title}
                          {reply.demo ? <i>Ejemplo</i> : null}
                        </strong>
                        <p>{reply.body}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code>{shortcutOf(reply.shortcut) || "—"}</code>
                  </td>
                  <td>
                    <div className="reply-keys">
                      {reply.keywords.length
                        ? reply.keywords.map((word) => <span key={word}>{word}</span>)
                        : <em>Sin palabras</em>}
                    </div>
                  </td>
                  <td>
                    <span className={`reply-status${reply.isActive ? "" : " off"}`}>
                      <i />
                      {reply.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td>
                    <div className="reply-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Vista previa de ${reply.title}`}
                        onClick={() => openForm(reply)}
                      >
                        <Icon name="eye" />
                      </button>
                      <button type="button" className="reply-edit" onClick={() => openForm(reply)}>
                        <Icon name="pencil" />
                        Editar
                      </button>
                      {!reply.demo ? (
                        <div className="catalog-more">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Más acciones de ${reply.title}`}
                            onClick={() => setMenuId((id) => (id === reply.id ? null : reply.id))}
                          >
                            <Icon name="more" />
                          </button>
                          {menuId === reply.id ? (
                            <div className="inbox-pop">
                              <button type="button" onClick={() => void toggleActive(reply)}>
                                {reply.isActive ? "Desactivar" : "Activar"}
                              </button>
                              <button type="button" onClick={() => void remove(reply)}>
                                Quitar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="pay-more-spacer" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="reply-foot">
            <p>Mostrando {filtered.length} respuesta{filtered.length === 1 ? "" : "s"}</p>
            <p>Escribe / en la bandeja para insertar una respuesta.</p>
          </footer>
        </div>
      )}

    </div>
  );
}
