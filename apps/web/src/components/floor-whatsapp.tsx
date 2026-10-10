"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ALERTS_CHANGED, notifyAlertsChanged } from "@/lib/events";
import { useApiGet } from "@/lib/use-api-get";
import { Icon } from "@/components/icons";
import { LoadingState } from "@/components/loading-state";

type AlertRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  conversationId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type Message = { id: string; content: string; direction: string; createdAt: string };

type ConversationRow = {
  id: string;
  status: string;
  humanTakeover: boolean;
  lastMessageAt: string;
  contact: { name?: string | null; phone: string };
  messages: Message[];
};

type Detail = ConversationRow & { messages: Message[] };

const HANDOFF_TYPES = new Set(["HUMAN_TAKEOVER", "NEEDS_REPLY", "BOT_FALLBACK"]);

export function FloorWhatsApp({ initialChatId, onConsumedInitial }: { initialChatId?: string | null; onConsumedInitial?: () => void }) {
  const { data: alerts, reload: reloadAlerts } = useApiGet<AlertRow[]>("/alerts?unread=1");
  const { data: conversations, reload: reloadList } = useApiGet<ConversationRow[]>("/conversations");
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const handoffChats = useMemo(() => {
    const rows = conversations ?? [];
    return rows.filter((c) => c.humanTakeover || c.status === "HUMAN");
  }, [conversations]);

  const alertRows = useMemo(() => {
    return (alerts ?? []).filter((a) => a.conversationId && HANDOFF_TYPES.has(a.type));
  }, [alerts]);

  const badgeCount = alertRows.length + handoffChats.filter((c) => !alertRows.some((a) => a.conversationId === c.id)).length;

  useEffect(() => {
    if (!initialChatId) return;
    void openChat(initialChatId);
    onConsumedInitial?.();
  }, [initialChatId]);

  useEffect(() => {
    const tick = () => {
      void reloadAlerts();
      void reloadList();
      if (chatId) void refreshChat(chatId);
    };
    tick();
    const id = window.setInterval(tick, 20000);
    window.addEventListener(ALERTS_CHANGED, tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(ALERTS_CHANGED, tick);
    };
  }, [chatId, reloadAlerts, reloadList]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [detail?.messages.length]);

  async function markAlertForChat(id: string) {
    const hit = alertRows.find((a) => a.conversationId === id);
    if (!hit || hit.readAt) return;
    await api(`/alerts/${hit.id}/read`, { method: "POST" }).catch(() => undefined);
    notifyAlertsChanged();
    void reloadAlerts();
  }

  async function refreshChat(id: string) {
    try {
      const row = await api<Detail>(`/conversations/${id}`);
      setDetail(row);
    } catch {
      /* ignore poll errors */
    }
  }

  async function openChat(id: string) {
    setLoadingChat(true);
    setError("");
    try {
      const row = await api<Detail>(`/conversations/${id}`);
      setChatId(id);
      setDetail(row);
      setDraft("");
      await markAlertForChat(id);
      if (!row.humanTakeover) {
        const updated = await api<Detail>(`/conversations/${id}/takeover`, { method: "POST" });
        setDetail(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el chat");
    } finally {
      setLoadingChat(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!chatId || !draft.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const updated = await api<Detail>(`/conversations/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: draft.trim() }),
      });
      setDetail(updated);
      setDraft("");
      void reloadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  async function releaseBot() {
    if (!chatId) return;
    setSending(true);
    setError("");
    try {
      await api<Detail>(`/conversations/${chatId}/release`, { method: "POST" });
      setChatId(null);
      setDetail(null);
      void reloadList();
      void reloadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar el bot");
    } finally {
      setSending(false);
    }
  }

  if (chatId && detail) {
    const label = detail.contact.name?.trim() || detail.contact.phone;
    return (
      <div className="floor-chat">
        <header className="floor-chat-head">
          <button type="button" className="icon-button" aria-label="Volver" onClick={() => { setChatId(null); setDetail(null); }}>
            <Icon name="chevron-left" />
          </button>
          <div>
            <strong>{label}</strong>
            <small>WhatsApp · cabañas</small>
          </div>
          <button type="button" className="btn ghost compact" disabled={sending} onClick={() => void releaseBot()}>
            Activar bot
          </button>
        </header>
        <div className="floor-chat-thread" ref={threadRef}>
          {detail.messages.map((m) => (
            <div key={m.id} className={`floor-chat-bubble ${m.direction === "OUTBOUND" ? "out" : "in"}`}>
              <p>{m.content}</p>
              <time>{new Date(m.createdAt).toLocaleString()}</time>
            </div>
          ))}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <form className="floor-chat-compose" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe por WhatsApp…"
            autoComplete="off"
          />
          <button type="submit" className="btn" disabled={sending || !draft.trim()}>
            {sending ? "…" : "Enviar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="floor-chat-list panel">
      <h1 className="mas-title">WhatsApp</h1>
      <p className="floor-chat-lead">Clientes que pidieron un asesor sobre cabañas. Respondes aquí y al terminar activas el bot.</p>
      {loadingChat ? <LoadingState compact label="Abriendo chat…" /> : null}
      {error && !chatId ? <p className="form-error">{error}</p> : null}

      {alertRows.length ? (
        <section className="floor-chat-section">
          <h2>Alertas {badgeCount ? `(${badgeCount})` : ""}</h2>
          {alertRows.map((a) => (
            <button key={a.id} type="button" className="floor-chat-card unread" onClick={() => void openChat(a.conversationId!)}>
              <strong>{a.title}</strong>
              <p>{a.body}</p>
              <small>{new Date(a.createdAt).toLocaleString()}</small>
            </button>
          ))}
        </section>
      ) : null}

      <section className="floor-chat-section">
        <h2>En atención humana</h2>
        {!handoffChats.length && !alertRows.length ? (
          <p className="muted">Sin chats pendientes. Cuando el bot pase a un asesor, avisamos aquí.</p>
        ) : null}
        {handoffChats.map((c) => {
          const last = c.messages[0];
          const preview = last?.content?.slice(0, 120) ?? "Sin mensajes";
          return (
            <button key={c.id} type="button" className="floor-chat-card" onClick={() => void openChat(c.id)}>
              <strong>{c.contact.name?.trim() || c.contact.phone}</strong>
              <p>{preview}</p>
              <small>{new Date(c.lastMessageAt).toLocaleString()}</small>
            </button>
          );
        })}
      </section>
    </div>
  );
}

export function countFloorHandoffs(
  alerts: Array<{ type: string; conversationId?: string | null; readAt?: string | null }> | null,
  conversations: Array<{ id: string; humanTakeover: boolean; status: string }> | null,
) {
  const alertIds = new Set(
    (alerts ?? [])
      .filter((a) => !a.readAt && a.conversationId && HANDOFF_TYPES.has(a.type))
      .map((a) => a.conversationId as string),
  );
  const chats = (conversations ?? []).filter((c) => c.humanTakeover || c.status === "HUMAN").map((c) => c.id);
  return new Set([...alertIds, ...chats]).size;
}
