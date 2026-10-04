"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, getSession, mediaUrl, type AuthUser } from "@/lib/api";
import { useAppPath } from "@/lib/app-path";
import { useApiGet } from "@/lib/use-api-get";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { BrandMark, Icon } from "@/components/icons";
import { channelMeta } from "@/lib/channels";

type Tag = { id: string; name: string; color?: string | null };
type ContactTag = { tag: Tag };
type Message = { id: string; content: string; direction: string; type?: string; createdAt?: string };

type ChannelRef = { id: string; type: string; name: string; flow?: { id: string; name: string } | null };

type Conversation = {
  id: string;
  status: string;
  humanTakeover: boolean;
  lastMessageAt: string;
  contact: {
    id?: string;
    name?: string | null;
    phone: string;
    audience?: "CLIENT" | "CONTACT";
    notes?: string | null;
    stage?: string;
    tags?: ContactTag[];
  };
  messages: Message[];
  channel?: ChannelRef | null;
};

type Detail = Conversation & {
  messages: Array<Message & { createdAt: string }>;
};

type Reply = { id: string; title: string; body: string; shortcut?: string | null };

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const EMOJIS = ["😊", "👍", "🙏", "👋", "❤️", "✅", "📅", "💰"];
const SIDE_OPEN_KEY = "aylluu.inbox.sideOpen";

type Filter = "all" | "unread" | "assigned";

export default function InboxPage() {
  const { query, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<Conversation[]>("/conversations");
  const { data: companyTags } = useApiGet<Tag[]>("/tags");
  const { data: channels } = useApiGet<ChannelRef[]>("/channels");
  const [current, setCurrent] = useState<Detail | null>(null);
  const [matched, setMatched] = useState<Reply[]>([]);
  const [all, setAll] = useState<Reply[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<AuthUser | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [sendError, setSendError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const chatId = query.get("c");

  useEffect(() => {
    if (localStorage.getItem(SIDE_OPEN_KEY) === "0") setSideOpen(false);
  }, []);

  function toggleSide() {
    setSideOpen((open) => {
      const next = !open;
      localStorage.setItem(SIDE_OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    api<{ name: string; email: string; platformRole: AuthUser["platformRole"] }>("/auth/me")
      .then((u) => setMe({ id: "", ...u }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (chatId) void open(chatId);
  }, [chatId]);

  useEffect(() => {
    if (!current) return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    const stored = readNotes(current.contact.id ?? current.id);
    setNotes(current.contact.notes || stored);
    setNotesSaved(Boolean(current.contact.notes || stored));
    setEmojiOpen(false);
    setMenuOpen(false);
    setTagOpen(false);
  }, [current?.id, current?.messages.length]);

  async function open(id: string) {
    setOpening(true);
    try {
      const detail = await api<Detail>(`/conversations/${id}`);
      setCurrent(detail);
      setDraft("");
      const sug = await api<{ matched: Reply[]; all: Reply[] }>(`/conversations/${id}/suggestions`);
      setMatched(sug.matched);
      setAll(sug.all);
      if (query.get("c") !== id) navigate(`/inbox?c=${id}`);
    } finally {
      setOpening(false);
    }
  }

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current || !draft.trim() || sending) return;
    setSending(true);
    setSendError("");
    try {
      const updated = await api<Detail>(`/conversations/${current.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });
      setCurrent(updated);
      setDraft("");
      reload();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  async function setTakeover(human: boolean) {
    if (!current) return;
    const path = human ? "takeover" : "release";
    setCurrent(await api<Detail>(`/conversations/${current.id}/${path}`, { method: "POST" }));
    reload();
  }

  async function addTag(tagId: string) {
    if (!current) return;
    setCurrent(await api<Detail>(`/conversations/${current.id}/tags`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    }));
    setTagOpen(false);
    reload();
  }

  async function removeTag(tagId: string) {
    if (!current) return;
    setCurrent(await api<Detail>(`/conversations/${current.id}/tags/${tagId}`, { method: "DELETE" }));
    reload();
  }

  async function setAudience(audience: "CLIENT" | "CONTACT") {
    if (!current?.contact.id) return;
    const updated = await api<{ audience: "CLIENT" | "CONTACT" }>(`/contacts/${current.contact.id}`, {
      method: "PATCH",
      body: JSON.stringify({ audience }),
    });
    setCurrent({ ...current, contact: { ...current.contact, audience: updated.audience } });
    reload();
  }

  async function saveNotes() {
    if (!current) return;
    writeNotes(current.contact.id ?? current.id, notes);
    if (current.contact.id) {
      try {
        await api(`/contacts/${current.contact.id}`, {
          method: "PATCH",
          body: JSON.stringify({ notes }),
        });
      } catch {
        setNotesSaved(false);
        return;
      }
    }
    setNotesSaved(true);
  }

  const waChannels = (channels ?? []).filter((ch) => ch.type === "WHATSAPP");
  const waItems = items === null ? null : items.filter(isWhatsAppConvo);
  const inChannel = (c: Conversation) => channelFilter === "all" || c.channel?.id === channelFilter;
  const unreadCount = waItems?.filter((c) => inChannel(c) && isUnread(c)).length ?? 0;
  const assignedCount = waItems?.filter((c) => inChannel(c) && c.humanTakeover).length ?? 0;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (waItems ?? []).filter((c) => {
      if (channelFilter !== "all" && c.channel?.id !== channelFilter) return false;
      if (filter === "unread" && !isUnread(c)) return false;
      if (filter === "assigned" && !c.humanTakeover) return false;
      if (!q) return true;
      const name = (c.contact.name || c.contact.phone).toLowerCase();
      const last = (c.messages[0]?.content ?? "").toLowerCase();
      return name.includes(q) || last.includes(q) || c.contact.phone.includes(q);
    });
  }, [waItems, filter, search, channelFilter]);

  const chips = (matched.length ? matched : all).slice(0, 6);
  const slashHits = useMemo(() => {
    if (!draft.startsWith("/")) return [];
    const q = draft.slice(1).trim().toLowerCase();
    return all
      .filter((r) => {
        const shortcut = (r.shortcut ?? "").replace(/^\//, "").toLowerCase();
        const title = r.title.toLowerCase();
        return !q || shortcut.startsWith(q) || title.includes(q);
      })
      .slice(0, 6);
  }, [all, draft]);
  const currentTags = current?.contact.tags?.map((t) => t.tag) ?? [];
  const unusedTags = (companyTags ?? []).filter((t) => !currentTags.some((x) => x.id === t.id));

  return (
    <div className={`inbox-page${current ? " has-chat" : ""}`}>
      <div className={`inbox${sideOpen ? "" : " is-side-collapsed"}`}>
        <section className="inbox-list">
          <div className="inbox-list-head">
            <label className="inbox-search">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversación…"
                aria-label="Buscar conversación"
              />
            </label>
            {waChannels.length > 1 ? (
              <div className="inbox-tabs inbox-channels" role="tablist" aria-label="Canal">
                <button type="button" className={channelFilter === "all" ? "on" : ""} onClick={() => setChannelFilter("all")}>
                  Todos
                </button>
                {waChannels.map((ch) => {
                  const n = (waItems ?? []).filter((c) => c.channel?.id === ch.id).length;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      className={channelFilter === ch.id ? "on" : ""}
                      onClick={() => setChannelFilter(ch.id)}
                    >
                      {ch.name || "WhatsApp"}
                      {n ? ` (${n})` : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="inbox-tabs" role="tablist">
              <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
                Todos {waItems ? `(${visibleAllCount(waItems, channelFilter)})` : ""}
              </button>
              <button type="button" className={filter === "unread" ? "on" : ""} onClick={() => setFilter("unread")}>
                Sin leer {unreadCount ? `(${unreadCount})` : ""}
              </button>
              <button type="button" className={filter === "assigned" ? "on" : ""} onClick={() => setFilter("assigned")}>
                Asignados {assignedCount ? `(${assignedCount})` : ""}
              </button>
            </div>
          </div>
          <div className="inbox-list-body">
            {waItems === null && <LoadingState compact label="Cargando chats…" />}
            {waItems && !waItems.length && (
              <EmptyState
                title="Todavía no hay chats"
                body="Cuando un cliente escriba por WhatsApp, el hilo aparece aquí."
              />
            )}
            {waItems && waItems.length > 0 && !visible.length && (
              <EmptyState title="Sin coincidencias" body="Prueba otro filtro o busca por nombre o teléfono." />
            )}
            {visible.map((c) => {
              const unread = isUnread(c);
              const name = c.contact.name || c.contact.phone;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`inbox-item${current?.id === c.id ? " on" : ""}${unread ? " unread" : ""}`}
                  onClick={() => (chatId === c.id ? void open(c.id) : navigate(`/inbox?c=${c.id}`))}
                >
                  <span className="avatar" style={avatarTone(name)}>
                    {initials(name)}
                  </span>
                  <span className="inbox-item-copy">
                    <span className="inbox-item-top">
                      <strong>{name}</strong>
                      <time>{formatListTime(c.lastMessageAt)}</time>
                    </span>
                    <span className="inbox-item-preview">
                      <span className="channel-pill sm" style={pillStyle(c.channel?.type)}>
                        {channelMeta(c.channel?.type).label}
                      </span>
                      {c.contact.audience === "CONTACT" ? (
                        <span className="badge quiet">Contacto</span>
                      ) : null}
                      <em>{c.messages[0]?.content || "Sin mensajes"}</em>
                      {unread ? <i className="inbox-dot" /> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="inbox-thread">
          {opening && !current ? (
            <LoadingState compact label="Abriendo conversación…" />
          ) : !current ? (
            <div className="inbox-empty">
              <BrandMark />
              <strong>Ningún chat seleccionado</strong>
              <p>Abre uno de la lista para ver el historial y responder.</p>
            </div>
          ) : (
            <>
              <header className="inbox-thread-head">
                <button type="button" className="inbox-back" onClick={() => { setCurrent(null); navigate("/inbox"); }} aria-label="Volver a la lista">
                  <Icon name="chevron-left" />
                </button>
                <span className="avatar" style={avatarTone(current.contact.name || current.contact.phone)}>
                  {initials(current.contact.name || current.contact.phone)}
                </span>
                <div className="inbox-thread-who">
                  <h2>
                    {current.contact.name || current.contact.phone}
                    <span className="channel-pill" style={pillStyle(current.channel?.type)}>
                      {channelMeta(current.channel?.type).label}
                    </span>
                  </h2>
                  <p>
                    {formatPhone(current.contact.phone)}
                    {current.channel?.flow?.name ? ` · Flujo ${current.channel.flow.name}` : ""}
                  </p>
                </div>
                <div className="inbox-thread-actions">
                  <span className={`inbox-assign ${current.contact.audience === "CONTACT" || current.humanTakeover ? "you" : "bot"}`}>
                    {current.contact.audience === "CONTACT"
                      ? "Contacto · el bot no responde"
                      : current.humanTakeover
                        ? "Asignado a ti"
                        : "Atendido por el bot"}
                  </span>
                  {current.contact.audience === "CONTACT" ? null : current.humanTakeover ? (
                    <button className="btn ghost compact" type="button" onClick={() => setTakeover(false)}>
                      <Icon name="bot" />
                      Devolver al bot
                    </button>
                  ) : (
                    <button className="btn secondary compact" type="button" onClick={() => setTakeover(true)}>
                      Tomar el chat
                    </button>
                  )}
                  <div className="inbox-more">
                    <button type="button" className="icon-btn" aria-label="Más acciones" onClick={() => setMenuOpen((v) => !v)}>
                      <Icon name="more" />
                    </button>
                    {menuOpen && (
                      <div className="inbox-pop">
                        {current.channel?.type === "WHATSAPP" && (
                          <a href={waLink(current.contact.phone)} target="_blank" rel="noreferrer">
                            Abrir en WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(current.contact.phone);
                            setMenuOpen(false);
                          }}
                        >
                          Copiar contacto
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="inbox-thread-body" ref={threadRef}>
                {groupMessages(current.messages).map((group) => (
                  <div key={group.day} className="inbox-day">
                    <p className="inbox-day-label">{group.label}</p>
                    {group.messages.map((m) => (
                      <div key={m.id} className={`bubble ${m.direction === "OUTBOUND" ? "out" : "in"}`}>
                        {m.type === "image" ? (
                          <img
                            className="bubble-photo"
                            src={mediaUrl(photoSrc(m.content))}
                            alt={photoCaption(m.content) || "Foto"}
                          />
                        ) : null}
                        {photoCaption(m.content) || m.type !== "image" ? (
                          <p>{m.type === "image" ? photoCaption(m.content) : m.content}</p>
                        ) : null}
                        <span className="bubble-meta">
                          {formatClock(m.createdAt)}
                          {m.direction === "OUTBOUND" ? <Icon name="checks" /> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {chips.length > 0 && (
                <div className="inbox-quick">
                  {chips.map((r) => (
                    <button key={r.id} className="inbox-quick-chip" type="button" onClick={() => setDraft(r.body)}>
                      {r.title}
                    </button>
                  ))}
                </div>
              )}

              <form className="inbox-composer" onSubmit={send}>
                {slashHits.length > 0 ? (
                  <div className="inbox-slash" role="listbox" aria-label="Respuestas guardadas">
                    {slashHits.map((r) => (
                      <button key={r.id} type="button" onClick={() => setDraft(r.body)}>
                        <b>{r.shortcut || r.title}</b>
                        <small>{r.title}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="icon-btn" aria-label="Adjuntar" disabled title="El envío de archivos llega después">
                  <Icon name="paperclip" />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  required
                  placeholder="Escribe un mensaje o /atajo…"
                />
                <div className="inbox-emoji">
                  <button type="button" className="icon-btn" aria-label="Emojis" onClick={() => setEmojiOpen((v) => !v)}>
                    <Icon name="smile" />
                  </button>
                  {emojiOpen && (
                    <div className="inbox-pop emoji-pop">
                      {EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => { setDraft((d) => d + e); setEmojiOpen(false); }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn send" disabled={sending}>
                  <Icon name="send" />
                  {sending ? "Enviando…" : "Enviar"}
                </button>
                {sendError ? <p className="error inbox-send-error">{sendError}</p> : null}
              </form>
            </>
          )}
        </section>

        <aside className={`inbox-side${current ? "" : " is-empty"}${sideOpen ? "" : " is-rail"}`}>
          {!sideOpen ? (
            <button type="button" className="inbox-side-rail" aria-expanded={false} onClick={toggleSide}>
              <Icon name="chevron-left" />
              <span>Canal y flujo</span>
            </button>
          ) : !current ? (
            <p className="inbox-side-placeholder">Elige un chat para ver los datos del contacto.</p>
          ) : (
            <>
              <section className="inbox-side-block">
                <button type="button" className="inbox-fold" aria-expanded={true} onClick={toggleSide}>
                  <h3>Canal y flujo</h3>
                  <Icon name="chevron-right" className="inbox-fold-chevron" />
                </button>
                <p>
                  <span className="channel-pill" style={pillStyle(current.channel?.type)}>
                    {channelMeta(current.channel?.type).label}
                  </span>
                </p>
                <p className="muted">
                  {current.channel?.name ?? "Sin canal"} ·{" "}
                  {current.channel?.flow?.name ?? "Flujo principal"}
                </p>
              </section>
              <section className="inbox-side-block">
                <h3>Datos del contacto</h3>
                <div className="inbox-contact-card">
                  <span className="avatar xl" style={avatarTone(current.contact.name || current.contact.phone)}>
                    {initials(current.contact.name || current.contact.phone)}
                  </span>
                  <strong>{current.contact.name || "Sin nombre"}</strong>
                  <p>{formatPhone(current.contact.phone)}</p>
                  <p>
                    <span className={`badge${current.contact.audience === "CONTACT" ? " quiet" : ""}`}>
                      {current.contact.audience === "CONTACT" ? "Contacto" : "Cliente"}
                    </span>
                    {current.contact.stage ? (
                      <span className={`crm-stage-pill stage-${current.contact.stage.toLowerCase()}`} style={{ marginLeft: 6 }}>
                        {crmStageLabel(current.contact.stage)}
                      </span>
                    ) : null}
                  </p>
                  {current.contact.id ? (
                    <button
                      type="button"
                      className="btn ghost compact"
                      onClick={() => void setAudience(current.contact.audience === "CONTACT" ? "CLIENT" : "CONTACT")}
                    >
                      {current.contact.audience === "CONTACT" ? "Pasar a cliente" : "Silenciar bot"}
                    </button>
                  ) : null}
                  {current.contact.id ? (
                    <button type="button" className="btn ghost compact" onClick={() => navigate(`/contacts?id=${current.contact.id}`)}>
                      Abrir en CRM
                    </button>
                  ) : null}
                  {current.channel?.type === "WHATSAPP" ? (
                    <a className="wa-link" href={waLink(current.contact.phone)} target="_blank" rel="noreferrer">
                      <BrandMark /> WhatsApp
                    </a>
                  ) : (
                    <p className="muted">Canal {channelMeta(current.channel?.type).label}</p>
                  )}
                </div>
              </section>

              <section className="inbox-side-block">
                <div className="inbox-side-row">
                  <h3>Etiquetas</h3>
                  <button type="button" className="icon-btn sm" aria-label="Añadir etiqueta" onClick={() => setTagOpen((v) => !v)}>
                    <Icon name="plus" />
                  </button>
                </div>
                <div className="inbox-tags">
                  {currentTags.map((tag) => (
                    <button key={tag.id} type="button" className="inbox-tag" style={tagStyle(tag.color)} onClick={() => removeTag(tag.id)}>
                      {tag.name} ×
                    </button>
                  ))}
                  {!currentTags.length && <p className="muted">Sin etiquetas</p>}
                </div>
                {tagOpen && (
                  <div className="inbox-pop tag-pop">
                    {unusedTags.map((tag) => (
                      <button key={tag.id} type="button" onClick={() => addTag(tag.id)}>
                        {tag.name}
                      </button>
                    ))}
                    {!unusedTags.length && <p className="muted">No hay más etiquetas</p>}
                  </div>
                )}
              </section>

              <section className="inbox-side-block">
                <h3>Asignado a</h3>
                <div className="inbox-agent">
                  <span className="avatar sm" style={avatarTone(current.humanTakeover ? me?.name || "Tú" : "Bot")}>
                    {current.humanTakeover ? initials(me?.name || "Tú") : <Icon name="bot" />}
                  </span>
                  <div>
                    <strong>
                      {current.contact.audience === "CONTACT"
                        ? "Sin bot"
                        : current.humanTakeover
                          ? me?.name || "Tú"
                          : "Bot AYLLUU"}
                    </strong>
                    <small>
                      {current.contact.audience === "CONTACT"
                        ? "Este número tiene rol Contacto"
                        : current.humanTakeover
                          ? "Asesor en esta empresa"
                          : "Responde automático"}
                    </small>
                  </div>
                </div>
              </section>

              <section className="inbox-side-block grow">
                <h3>Notas internas</h3>
                <textarea
                  className="inbox-notes"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesSaved(false);
                  }}
                  onBlur={() => void saveNotes()}
                  placeholder="Solo lo ve el equipo. El cliente no lee esto."
                  rows={5}
                />
                <p className="inbox-notes-meta">
                  {notesSaved
                    ? "Guardada en el CRM"
                    : "Se guarda al salir del recuadro"}
                </p>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function isWhatsAppConvo(c: Conversation) {
  return !c.channel || c.channel.type === "WHATSAPP";
}

function visibleAllCount(items: Conversation[] | null, channelFilter: string) {
  if (!items) return 0;
  if (channelFilter === "all") return items.length;
  return items.filter((c) => c.channel?.id === channelFilter).length;
}

function pillStyle(type?: string | null) {
  const meta = channelMeta(type);
  return { color: meta.color, background: meta.bg };
}

function isUnread(c: Conversation) {
  return c.messages[0]?.direction === "INBOUND";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const TONES = [
  ["#ede9fe", "#6d28d9"],
  ["#ffedd5", "#c2410c"],
  ["#dcfce7", "#15803d"],
  ["#dbeafe", "#1d4ed8"],
  ["#fce7f3", "#be185d"],
  ["#ccfbf1", "#0f766e"],
];

function avatarTone(name: string) {
  let n = 0;
  for (const ch of name) n += ch.charCodeAt(0);
  const [bg, color] = TONES[n % TONES.length];
  return { background: bg, color };
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("593")) {
    return `+593 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length >= 11 && digits.startsWith("51")) {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return phone.startsWith("+") ? phone : `+${digits || phone}`;
}

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function formatClock(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function formatListTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatClock(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}.`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const prefix = d.toDateString() === now.toDateString() ? "Hoy" : MONTHS[d.getMonth()];
  if (d.toDateString() === now.toDateString()) {
    return `Hoy, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  }
  return `${d.getDate()} de ${prefix}`;
}

function groupMessages(messages: Array<Message & { createdAt?: string }>) {
  const groups: { day: string; label: string; messages: typeof messages }[] = [];
  for (const m of messages) {
    const key = m.createdAt ? dayKey(m.createdAt) : "sin-fecha";
    const last = groups[groups.length - 1];
    if (!last || last.day !== key) {
      groups.push({ day: key, label: m.createdAt ? dayLabel(m.createdAt) : "Mensajes", messages: [m] });
    } else {
      last.messages.push(m);
    }
  }
  return groups;
}

function tagStyle(color?: string | null) {
  if (!color) return undefined;
  return { background: `${color}22`, color, borderColor: `${color}55` };
}

function photoSrc(content: string) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => /^(https?:\/\/|\/uploads\/)/i.test(l)) ?? lines[lines.length - 1] ?? content;
}

function photoCaption(content: string) {
  const src = photoSrc(content);
  const caption = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== src)
    .join("\n");
  return caption;
}

function crmStageLabel(stage: string) {
  const labels: Record<string, string> = {
    NEW: "Nuevo",
    TALKING: "Conversación",
    INTERESTED: "Interesado",
    RESERVED: "Reserva",
    WON: "Cerrado",
    LOST: "Perdido",
  };
  return labels[stage] ?? stage;
}

function notesKey(contactId: string) {
  const company = getSession()?.companyId ?? "";
  return `aylluu.notes.${company}.${contactId}`;
}

function readNotes(contactId: string) {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(notesKey(contactId)) ?? "";
}

function writeNotes(contactId: string, value: string) {
  localStorage.setItem(notesKey(contactId), value);
}
