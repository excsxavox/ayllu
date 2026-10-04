"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { useAppPath } from "@/lib/app-path";
import { formatMoney } from "@/lib/money";

type Audience = "CLIENT" | "CONTACT";
type Stage = "NEW" | "TALKING" | "INTERESTED" | "RESERVED" | "WON" | "LOST";
type Source = "WHATSAPP" | "MANUAL" | "WALKIN" | "OTHER";
type View = "board" | "list";

type Tag = { id: string; name: string; color?: string | null };

type Activity = {
  id: string;
  type: "NOTE" | "STAGE" | "FOLLOW";
  body: string;
  createdAt: string;
  user?: { name: string } | null;
};

type BookingRow = {
  id: string;
  startsAt: string;
  status: string;
  paymentStatus: string;
  service?: { name: string } | null;
  product?: { name: string } | null;
};

type Contact = {
  id: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  audience: Audience;
  stage: Stage;
  source: Source;
  notes?: string | null;
  expectedValue?: string | number | null;
  nextActionAt?: string | null;
  nextAction?: string | null;
  lostReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tags?: { tag: Tag }[];
  conversations?: Array<{
    id: string;
    lastMessageAt: string;
    messages: Array<{ content: string; direction: string; createdAt: string }>;
  }>;
  bookings?: BookingRow[];
  activities?: Activity[];
  _count?: { conversations: number; bookings: number };
};

type Draft = {
  id: string;
  name: string;
  phone: string;
  email: string;
  audience: Audience;
  stage: Stage;
  source: Source;
  notes: string;
  expectedValue: string;
  nextActionAt: string;
  nextAction: string;
  lostReason: string;
};

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "NEW", label: "Nuevo", hint: "Acaba de escribir o lo agregaste" },
  { id: "TALKING", label: "Conversación", hint: "Ya hay ida y vuelta" },
  { id: "INTERESTED", label: "Interesado", hint: "Pregunta fechas o precios" },
  { id: "RESERVED", label: "Reserva", hint: "Pidió abono o tiene fecha" },
  { id: "WON", label: "Cerrado", hint: "Ya vino o pagó" },
  { id: "LOST", label: "Perdido", hint: "No sigue" },
];

const SOURCE_LABEL: Record<Source, string> = {
  WHATSAPP: "WhatsApp",
  MANUAL: "Manual",
  WALKIN: "En el local",
  OTHER: "Otro",
};

const BOOKING_STATUS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  NO_SHOW: "No llegó",
};

const OPEN_STAGES: Stage[] = ["NEW", "TALKING", "INTERESTED", "RESERVED"];

export default function ContactsPage() {
  const { ask } = useConfirm();
  const { path, query, navigate } = useAppPath();
  const { data: items, reload, setData } = useApiGet<Contact[]>("/contacts");
  const { data: companyTags } = useApiGet<Tag[]>("/tags");
  const openId = path === "/contacts" ? query.get("id") : null;
  const view: View = path === "/contacts" && query.get("view") === "list" ? "list" : "board";
  const tagFromUrl = path === "/contacts" ? (query.get("tag") ?? "") : "";
  const [tagFilter, setTagFilter] = useState(tagFromUrl);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    if (tagFromUrl) setTagFilter(tagFromUrl);
  }, [tagFromUrl]);

  useEffect(() => {
    if (!openId) {
      setDraft(null);
      return;
    }
    if (openId === "new") {
      setDraft((prev) => (prev && !prev.id ? prev : emptyDraft()));
      return;
    }
    const found = (items ?? []).find((c) => c.id === openId);
    if (found) setDraft(toDraft(found));
  }, [openId, items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((c) => {
      if (tagFilter && !(c.tags ?? []).some((row) => row.tag.id === tagFilter)) return false;
      if (!q) return true;
      const name = (c.name || "").toLowerCase();
      const tagText = (c.tags ?? []).map((row) => row.tag.name.toLowerCase()).join(" ");
      const digits = q.replace(/\D/g, "");
      return name.includes(q) || tagText.includes(q) || c.phone.includes(q) || (digits && c.phone.includes(digits));
    });
  }, [items, search, tagFilter]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const open = list.filter((c) => OPEN_STAGES.includes(c.stage));
    const today = startOfDay(new Date()).getTime();
    return {
      open: open.length,
      value: open.reduce((sum, c) => sum + moneyOf(c.expectedValue), 0),
      follow: list.filter((c) => c.nextActionAt && new Date(c.nextActionAt).getTime() <= today + 86400000).length,
      reserved: list.filter((c) => c.stage === "RESERVED").length,
    };
  }, [items]);

  function setView(next: View) {
    navigate(contactsUrl({ view: next, tag: tagFilter, id: openId }));
  }

  function openContact(id: string | null) {
    navigate(contactsUrl({ view, tag: tagFilter, id }));
  }

  async function moveStage(contact: Contact, stage: Stage) {
    if (contact.stage === stage) return;
    setData((items ?? []).map((row) => (row.id === contact.id ? { ...row, stage } : row)));
    await api(`/contacts/${contact.id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
    await reload();
  }

  async function remove(c: Contact) {
    const label = c.name || formatPhone(c.phone);
    const extra = c._count?.conversations
      ? `También se borrarán ${c._count.conversations} conversaciones.`
      : "Sale del CRM. Puedes volver a agregarlo después.";
    const ok = await ask({
      title: `¿Quitar a ${label}?`,
      body: extra,
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    await api(`/contacts/${c.id}`, { method: "DELETE" });
    if (openId === c.id) openContact(null);
    await reload();
  }

  return (
    <div className="crm-page">
      <PageHeader
        actions={
          <button type="button" className="btn" onClick={() => openContact("new")}>
            <Icon name="plus" />
            Nuevo contacto
          </button>
        }
      />

      <div className="crm-stats">
        <article>
          <Icon name="kanban" />
          <div>
            <strong>{items ? stats.open : "—"}</strong>
            <p>En el embudo</p>
          </div>
        </article>
        <article>
          <Icon name="cash" />
          <div>
            <strong>{items ? formatMoney(stats.value) : "—"}</strong>
            <p>Valor abierto</p>
          </div>
        </article>
        <article>
          <Icon name="clock" />
          <div>
            <strong>{items ? stats.follow : "—"}</strong>
            <p>A seguir hoy</p>
          </div>
        </article>
        <article>
          <Icon name="calendar" />
          <div>
            <strong>{items ? stats.reserved : "—"}</strong>
            <p>Con reserva</p>
          </div>
        </article>
      </div>

      <div className="crm-toolbar">
        <div className="catalog-tabs" role="tablist" aria-label="Vista del CRM">
          <button type="button" role="tab" aria-selected={view === "board"} className={view === "board" ? "active" : ""} onClick={() => setView("board")}>
            Embudo
          </button>
          <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            Lista
          </button>
        </div>
        <label className="catalog-search">
          <Icon name="search" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, teléfono o etiqueta" aria-label="Buscar en el CRM" />
        </label>
        <label className="crm-tag-filter">
          <span>Etiqueta</span>
          <select
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              navigate(contactsUrl({ view, tag: e.target.value, id: openId }));
            }}
            aria-label="Filtrar por etiqueta"
          >
            <option value="">Todas</option>
            {(companyTags ?? []).map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {items === null && <LoadingState compact label="Cargando CRM…" />}
      {items && !items.length && (
        <EmptyState
          title="Nadie en el CRM"
          body="Quien escriba por WhatsApp entra solo. También puedes agregar a alguien a mano."
        />
      )}
      {items && items.length > 0 && !visible.length && (
        <EmptyState title="Sin coincidencias" body="Prueba otro nombre, teléfono o etiqueta." />
      )}

      {items && visible.length > 0 && view === "board" && (
        <div className="crm-board" onDragOver={(e) => e.preventDefault()}>
          {STAGES.map((col) => {
            const cards = visible.filter((c) => c.stage === col.id);
            const total = cards.reduce((sum, c) => sum + moneyOf(c.expectedValue), 0);
            return (
              <section
                key={col.id}
                className={`crm-col stage-${col.id.toLowerCase()}${dragging ? " is-drop" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  const card = (items ?? []).find((c) => c.id === id);
                  setDragging(null);
                  if (card) void moveStage(card, col.id);
                }}
              >
                <header>
                  <div>
                    <strong>{col.label}</strong>
                    <p>{col.hint}</p>
                  </div>
                  <span>{cards.length}</span>
                </header>
                {total > 0 ? <p className="crm-col-value">{formatMoney(total)}</p> : null}
                <div className="crm-col-cards">
                  {cards.map((c) => (
                    <CrmCard
                      key={c.id}
                      contact={c}
                      dragging={dragging === c.id}
                      onOpen={() => openContact(c.id)}
                      onDragStart={() => setDragging(c.id)}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {items && visible.length > 0 && view === "list" && (
        <div className="card catalog-card">
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Etapa</th>
                  <th>Valor</th>
                  <th>Próxima</th>
                  <th>Último chat</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const last = lastMessage(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="catalog-product">
                          <span className="admin-avatar" style={avatarTone(c.name || c.phone)}>
                            {initials(c.name || c.phone)}
                          </span>
                          <div>
                            <strong>{c.name || "Sin nombre"}</strong>
                            <small>{formatPhone(c.phone)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`crm-stage-pill stage-${c.stage.toLowerCase()}`}>{stageLabel(c.stage)}</span>
                      </td>
                      <td className="nowrap">{moneyOf(c.expectedValue) ? formatMoney(c.expectedValue ?? 0) : "—"}</td>
                      <td>{nextActionLabel(c)}</td>
                      <td className="crm-last">{last || "Sin chat"}</td>
                      <td>
                        <div className="catalog-actions">
                          <button type="button" className="icon-btn" aria-label={`Abrir ${c.name || c.phone}`} onClick={() => openContact(c.id)}>
                            <Icon name="pencil" />
                          </button>
                          {c.conversations?.[0]?.id ? (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Abrir chat"
                              onClick={() => navigate(`/inbox?c=${c.conversations![0].id}`)}
                            >
                              <Icon name="whatsapp" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <footer className="catalog-pager">
              <p>
                {visible.length} contacto{visible.length === 1 ? "" : "s"}
              </p>
            </footer>
          </div>
        </div>
      )}

      {draft ? (
        <ContactDrawer
          draft={draft}
          contact={(items ?? []).find((c) => c.id === draft.id) ?? null}
          tags={companyTags ?? []}
          onChange={setDraft}
          onClose={() => openContact(null)}
          onReload={reload}
          onRemove={draft.id ? () => void remove((items ?? []).find((c) => c.id === draft.id)!).catch(() => undefined) : undefined}
        />
      ) : null}
    </div>
  );
}

function CrmCard({
  contact,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  contact: Contact;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const last = lastMessage(contact);
  const overdue = isOverdue(contact.nextActionAt);
  return (
    <article
      className={`crm-card${dragging ? " is-dragging" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", contact.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
    >
      <header>
        <span className="admin-avatar" style={avatarTone(contact.name || contact.phone)}>
          {initials(contact.name || contact.phone)}
        </span>
        <div>
          <strong>{contact.name || "Sin nombre"}</strong>
          <p>{formatPhone(contact.phone)}</p>
        </div>
      </header>
      {last ? <p className="crm-card-last">{last}</p> : null}
      <footer>
        <span>{moneyOf(contact.expectedValue) ? formatMoney(contact.expectedValue ?? 0) : SOURCE_LABEL[contact.source]}</span>
        {contact.nextActionAt ? (
          <span className={overdue ? "is-late" : ""}>
            <Icon name="clock" />
            {shortDate(contact.nextActionAt)}
          </span>
        ) : null}
      </footer>
      {(contact.tags ?? []).length > 0 ? (
        <div className="crm-card-tags">
          {(contact.tags ?? []).slice(0, 3).map((row) => (
            <i key={row.tag.id} className="tag-chip" style={chipStyle(row.tag.color)}>
              {row.tag.name}
            </i>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ContactDrawer({
  draft,
  contact,
  tags,
  onChange,
  onClose,
  onReload,
  onRemove,
}: {
  draft: Draft;
  contact: Contact | null;
  tags: Tag[];
  onChange: (next: Draft) => void;
  onClose: () => void;
  onReload: () => Promise<unknown>;
  onRemove?: () => void;
}) {
  const { navigate } = useAppPath();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const creating = !draft.id;
  const assigned = contact?.tags?.map((row) => row.tag) ?? [];
  const unused = tags.filter((tag) => !assigned.some((t) => t.id === tag.id));
  const chatId = contact?.conversations?.[0]?.id;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    onChange({ ...draft, [key]: value });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: draft.name.trim() || null,
        email: draft.email.trim() || null,
        audience: draft.audience,
        stage: draft.stage,
        source: draft.source,
        notes: draft.notes.trim() || null,
        expectedValue: draft.expectedValue === "" ? null : Number(draft.expectedValue),
        nextActionAt: draft.nextActionAt ? `${draft.nextActionAt}T12:00:00.000Z` : null,
        nextAction: draft.nextAction.trim() || null,
        lostReason: draft.lostReason.trim() || null,
      };
      if (creating) {
        await api("/contacts", {
          method: "POST",
          body: JSON.stringify({ ...payload, phone: draft.phone }),
        });
      } else {
        await api(`/contacts/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      await onReload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!draft.id || !note.trim()) return;
    setSaving(true);
    try {
      await api(`/contacts/${draft.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: note.trim() }),
      });
      setNote("");
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la nota");
    } finally {
      setSaving(false);
    }
  }

  async function addTag(tagId: string) {
    if (!draft.id) return;
    await api(`/contacts/${draft.id}/tags`, { method: "POST", body: JSON.stringify({ tagId }) });
    await onReload();
  }

  async function removeTag(tagId: string) {
    if (!draft.id) return;
    await api(`/contacts/${draft.id}/tags/${tagId}`, { method: "DELETE" });
    await onReload();
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer crm-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2>{creating ? "Nuevo contacto" : draft.name || formatPhone(draft.phone)}</h2>
            <p>{creating ? "Entra al embudo. El bot le responde si lo dejas como cliente." : formatPhone(draft.phone)}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <form className="crm-form" onSubmit={(e) => void save(e)}>
          <div className="crm-stage-row" role="group" aria-label="Etapa">
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                type="button"
                className={`crm-stage-pill stage-${stage.id.toLowerCase()}${draft.stage === stage.id ? " on" : ""}`}
                onClick={() => set("stage", stage.id)}
              >
                {stage.label}
              </button>
            ))}
          </div>

          <label>
            <span>Nombre</span>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Ana Pérez" />
          </label>
          {creating ? (
            <label>
              <span>Teléfono</span>
              <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} required placeholder="+51 999 888 777" inputMode="tel" />
            </label>
          ) : null}
          <label>
            <span>Correo</span>
            <input value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="ana@correo.com" type="email" />
          </label>

          <div className="crm-split">
            <label>
              <span>Rol</span>
              <select value={draft.audience} onChange={(e) => set("audience", e.target.value as Audience)}>
                <option value="CLIENT">Cliente · el bot responde</option>
                <option value="CONTACT">Contacto · sin bot</option>
              </select>
            </label>
            <label>
              <span>Origen</span>
              <select value={draft.source} onChange={(e) => set("source", e.target.value as Source)}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="MANUAL">Manual</option>
                <option value="WALKIN">En el local</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
          </div>

          <label>
            <span>Valor estimado</span>
            <input
              value={draft.expectedValue}
              onChange={(e) => set("expectedValue", e.target.value)}
              placeholder="80"
              inputMode="decimal"
            />
          </label>

          <div className="crm-split">
            <label>
              <span>Próxima acción</span>
              <input value={draft.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="Confirmar abono" />
            </label>
            <label>
              <span>Fecha</span>
              <input type="date" value={draft.nextActionAt} onChange={(e) => set("nextActionAt", e.target.value)} />
            </label>
          </div>

          {draft.stage === "LOST" ? (
            <label>
              <span>Por qué se perdió</span>
              <input value={draft.lostReason} onChange={(e) => set("lostReason", e.target.value)} placeholder="Eligió otro lugar, no contestó…" />
            </label>
          ) : null}

          <label>
            <span>Notas internas</span>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder="Solo lo ve el equipo. El cliente no lee esto."
            />
          </label>

          {error ? <p className="crm-error">{error}</p> : null}

          <div className="pay-cfg-foot">
            {!creating && onRemove ? (
              <button type="button" className="btn danger ghost" onClick={onRemove}>
                Quitar
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn" disabled={saving}>
              {saving ? "Guardando…" : creating ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>

        {!creating && contact ? (
          <>
            <section className="crm-block">
              <h3>Etiquetas</h3>
              <div className="contact-tags">
                {assigned.map((tag) => (
                  <button key={tag.id} type="button" className="inbox-tag" style={tagStyle(tag.color)} onClick={() => void removeTag(tag.id)}>
                    {tag.name} ×
                  </button>
                ))}
                {unused.map((tag) => (
                  <button key={tag.id} type="button" className="btn ghost compact" onClick={() => void addTag(tag.id)}>
                    + {tag.name}
                  </button>
                ))}
                {!tags.length ? <p className="muted">Crea etiquetas para marcar a la gente.</p> : null}
              </div>
            </section>

            <section className="crm-block">
              <h3>WhatsApp</h3>
              <div className="crm-links">
                {chatId ? (
                  <button type="button" className="btn secondary" onClick={() => navigate(`/inbox?c=${chatId}`)}>
                    <Icon name="inbox" />
                    Abrir chat
                  </button>
                ) : (
                  <p className="muted">Aún no hay conversación.</p>
                )}
                <a className="btn ghost" href={waLink(draft.phone)} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" />
                  WhatsApp
                </a>
              </div>
            </section>

            <section className="crm-block">
              <h3>Reservas</h3>
              {(contact.bookings ?? []).length ? (
                <ul className="crm-bookings">
                  {(contact.bookings ?? []).map((b) => (
                    <li key={b.id}>
                      <strong>{b.service?.name || b.product?.name || "Reserva"}</strong>
                      <span>
                        {shortDate(b.startsAt)} · {BOOKING_STATUS[b.status] ?? b.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Sin reservas ligadas.</p>
              )}
              {(contact._count?.bookings ?? 0) > 0 ? (
                <button type="button" className="btn ghost compact" onClick={() => navigate("/bookings")}>
                  Ver agenda
                </button>
              ) : null}
            </section>

            <section className="crm-block">
              <h3>Actividad</h3>
              <form className="crm-note-form" onSubmit={(e) => void addNote(e)}>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anota un seguimiento…" />
                <button className="btn compact" disabled={saving || !note.trim()}>
                  Añadir
                </button>
              </form>
              <ol className="crm-timeline">
                {(contact.activities ?? []).map((row) => (
                  <li key={row.id}>
                    <i className={`crm-dot ${row.type.toLowerCase()}`} />
                    <div>
                      <p>{row.body}</p>
                      <small>
                        {row.user?.name ? `${row.user.name} · ` : ""}
                        {shortDateTime(row.createdAt)} · {row.type === "STAGE" ? "Etapa" : row.type === "FOLLOW" ? "Seguimiento" : "Nota"}
                      </small>
                    </div>
                  </li>
                ))}
                {!(contact.activities ?? []).length ? <p className="muted">Aún no hay movimientos.</p> : null}
              </ol>
            </section>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function emptyDraft(): Draft {
  return {
    id: "",
    name: "",
    phone: "",
    email: "",
    audience: "CLIENT",
    stage: "NEW",
    source: "MANUAL",
    notes: "",
    expectedValue: "",
    nextActionAt: "",
    nextAction: "",
    lostReason: "",
  };
}

function toDraft(c: Contact): Draft {
  return {
    id: c.id,
    name: c.name || "",
    phone: c.phone,
    email: c.email || "",
    audience: c.audience,
    stage: c.stage || "NEW",
    source: c.source || "WHATSAPP",
    notes: c.notes || "",
    expectedValue: c.expectedValue == null || c.expectedValue === "" ? "" : String(Number(c.expectedValue)),
    nextActionAt: c.nextActionAt ? c.nextActionAt.slice(0, 10) : "",
    nextAction: c.nextAction || "",
    lostReason: c.lostReason || "",
  };
}

function contactsUrl(opts: { view: View; tag: string; id: string | null }) {
  const q = new URLSearchParams();
  if (opts.view === "list") q.set("view", "list");
  if (opts.tag) q.set("tag", opts.tag);
  if (opts.id) q.set("id", opts.id);
  const s = q.toString();
  return s ? `/contacts?${s}` : "/contacts";
}

function stageLabel(stage: Stage) {
  return STAGES.find((s) => s.id === stage)?.label ?? stage;
}

function moneyOf(value?: string | number | null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lastMessage(c: Contact) {
  const text = c.conversations?.[0]?.messages?.[0]?.content?.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function nextActionLabel(c: Contact) {
  if (!c.nextActionAt && !c.nextAction) return "—";
  const date = c.nextActionAt ? shortDate(c.nextActionAt) : "";
  return [c.nextAction, date].filter(Boolean).join(" · ");
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < startOfDay(new Date()).getTime();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function shortDateTime(value: string) {
  return new Date(value).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("51")) {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return phone.startsWith("+") ? phone : `+${digits || phone}`;
}

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
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
  const tones = ["#147d63", "#1d4e5f", "#c45c3e", "#3d5a80", "#2a6f6a"];
  const n = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return { background: `${tones[n % tones.length]}1f`, color: tones[n % tones.length] };
}

function chipStyle(color?: string | null) {
  const hex = color || "#147d63";
  return { background: `${hex}22`, color: hex };
}

function tagStyle(color?: string | null) {
  if (!color) return undefined;
  return { background: color, color: "#fff", borderColor: color };
}
