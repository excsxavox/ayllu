"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { api } from "@/lib/api";
import { BrandMark, Icon } from "@/components/icons";

export type ReplyDraft = {
  id: string;
  title: string;
  body: string;
  shortcut?: string | null;
  keywords: string[];
  isActive: boolean;
};

const EXAMPLE: ReplyDraft = {
  id: "",
  title: "Precios",
  body: "¡Hola! Te comparto nuestros precios vigentes.\n\nCuéntame qué producto o servicio te interesa y con gusto te ayudo.",
  shortcut: "/precios",
  keywords: ["precio", "costo", "cotización"],
  isActive: true,
};

const EMOJIS = ["😊", "👍", "🙏", "👋", "❤️", "✅", "📅", "💰"];

function shortcutOf(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function waPreview(text: string) {
  return escapeHtml(text)
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

export function ReplyConfig({
  reply,
  companyName,
  onCancel,
  onSaved,
}: {
  reply: ReplyDraft;
  companyName?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ReplyDraft>({
    ...reply,
    shortcut: shortcutOf(reply.shortcut),
    keywords: [...reply.keywords],
    body: reply.body ?? "",
  });
  const [snapshot] = useState<ReplyDraft>({ ...reply, shortcut: shortcutOf(reply.shortcut) });
  const [examples, setExamples] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selRef = useRef({ start: 0, end: 0 });

  function set<K extends keyof ReplyDraft>(key: K, value: ReplyDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function rememberSelection() {
    const el = bodyRef.current;
    if (!el) return;
    selRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
      selRef.current = { start, end };
    });
  }

  function toggleExamples() {
    const next = !examples;
    setExamples(next);
    setDraft(next ? { ...EXAMPLE, id: draft.id } : { ...snapshot, id: draft.id, keywords: [...snapshot.keywords] });
    setKeyword("");
  }

  function wrap(marker: string) {
    rememberSelection();
    const { start, end } = selRef.current;
    setDraft((prev) => {
      const selected = prev.body.slice(start, end);
      const inner = selected || "texto";
      const before = prev.body.slice(0, start);
      const after = prev.body.slice(end);
      const wrapped = selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2;
      const around = before.endsWith(marker) && after.startsWith(marker);
      if (wrapped) {
        const plain = selected.slice(marker.length, selected.length - marker.length);
        restoreSelection(start, start + plain.length);
        return { ...prev, body: `${before}${plain}${after}` };
      }
      if (around) {
        restoreSelection(start - marker.length, end - marker.length);
        return { ...prev, body: `${before.slice(0, -marker.length)}${selected}${after.slice(marker.length)}` };
      }
      restoreSelection(start + marker.length, start + marker.length + inner.length);
      return { ...prev, body: `${before}${marker}${inner}${marker}${after}` };
    });
  }

  function insertEmoji(emoji: string) {
    rememberSelection();
    const { start, end } = selRef.current;
    setDraft((prev) => {
      const caret = start + emoji.length;
      restoreSelection(caret, caret);
      return { ...prev, body: `${prev.body.slice(0, start)}${emoji}${prev.body.slice(end)}` };
    });
    setEmojiOpen(false);
  }

  function addKeyword(raw: string) {
    const word = raw.trim().replace(/,$/, "");
    if (!word || draft.keywords.includes(word)) {
      setKeyword("");
      return;
    }
    set("keywords", [...draft.keywords, word]);
    setKeyword("");
  }

  function onKeywordKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keyword);
    }
    if (e.key === "Backspace" && !keyword && draft.keywords.length) {
      set("keywords", draft.keywords.slice(0, -1));
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      shortcut: shortcutOf(draft.shortcut) || null,
      keywords: draft.keywords,
      isActive: draft.isActive,
    };
    setSaving(true);
    setError("");
    try {
      if (draft.id) {
        await api(`/replies/${draft.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/replies", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const previewHtml = waPreview(draft.body.trim() || "Escribe el texto de la respuesta.");
  const shortcut = shortcutOf(draft.shortcut) || "/atajo";

  return (
    <form className="reply-cfg" onSubmit={onSubmit}>
      <button type="button" className="pay-cfg-back" onClick={onCancel}>
        <Icon name="chevron-left" />
        Volver a respuestas
      </button>

      <header className="pay-cfg-head">
        <div>
          <h1>Configuración de respuesta</h1>
          <p>Define el contenido y encuéntralo desde la bandeja.</p>
        </div>
        <label className="pay-cfg-example">
          <span>Datos de ejemplo</span>
          <button
            type="button"
            className="pay-switch"
            role="switch"
            aria-checked={examples}
            aria-label="Datos de ejemplo"
            onClick={toggleExamples}
          >
            <i />
          </button>
        </label>
      </header>

      <div className="reply-cfg-board">
        <div>
          <section className="pay-cfg-block">
            <h2>1. Información general</h2>
            <div className="pay-cfg-grid">
              <label>
                <span>Título *</span>
                <input value={draft.title} onChange={(e) => set("title", e.target.value)} required placeholder="Precios" />
              </label>
              <label>
                <span>Atajo</span>
                <input
                  value={draft.shortcut ?? ""}
                  onChange={(e) => set("shortcut", shortcutOf(e.target.value))}
                  placeholder="/precios"
                />
                <small className="reply-cfg-hint">Úsalo para insertar esta respuesta en la bandeja.</small>
              </label>
            </div>
          </section>

          <section className="pay-cfg-block">
            <h2>2. Contenido del mensaje</h2>
            <label>
              <span>Texto de la respuesta *</span>
              <div className="reply-editor">
                <div className="reply-editor-bar">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => wrap("*")}
                    aria-label="Negrita"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className="is-italic"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => wrap("_")}
                    aria-label="Cursiva"
                  >
                    I
                  </button>
                  <div className="reply-emoji">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setEmojiOpen((v) => !v)}
                      aria-label="Emoji"
                    >
                      <Icon name="smile" />
                    </button>
                    {emojiOpen ? (
                      <div className="inbox-pop reply-emoji-pop">
                        {EMOJIS.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertEmoji(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <textarea
                  ref={bodyRef}
                  required
                  rows={6}
                  value={draft.body}
                  onSelect={rememberSelection}
                  onKeyUp={rememberSelection}
                  onClick={rememberSelection}
                  onChange={(e) => {
                    set("body", e.target.value);
                    rememberSelection();
                  }}
                  placeholder="¡Hola! Te comparto nuestros precios vigentes."
                />
              </div>
              <small className="reply-cfg-hint">Así se verá el mensaje al insertarlo.</small>
            </label>
          </section>

          <section className="pay-cfg-block">
            <h2>3. Organización y disponibilidad</h2>
            <div className="reply-keys-field">
              <span>Palabras clave</span>
              <div className="reply-chip-box">
                {draft.keywords.map((word) => (
                  <button key={word} type="button" className="reply-chip" onClick={() => set("keywords", draft.keywords.filter((w) => w !== word))}>
                    {word}
                    <Icon name="close" />
                  </button>
                ))}
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={onKeywordKey}
                  onBlur={() => addKeyword(keyword)}
                  placeholder={draft.keywords.length ? "" : "precio, costo"}
                  aria-label="Agregar palabra clave"
                />
              </div>
              <small className="reply-cfg-hint">Facilita encontrar esta respuesta en la bandeja.</small>
            </div>
            <div className="pay-cfg-active">
              <button
                type="button"
                className="pay-switch"
                role="switch"
                aria-checked={draft.isActive}
                onClick={() => set("isActive", !draft.isActive)}
                aria-label={draft.isActive ? "Desactivar respuesta" : "Activar respuesta"}
              >
                <i />
              </button>
              <div>
                <strong>Respuesta activa</strong>
                <p>Disponible para que el equipo la utilice.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="reply-cfg-preview" aria-label="Vista previa en WhatsApp">
          <h2>Vista previa en WhatsApp</h2>
          <div className="reply-phone">
            <header>
              <Icon name="chevron-left" />
              <BrandMark />
              <div>
                <strong>Asistente {companyName ?? "Ayllu"}</strong>
                <small>Vista previa</small>
              </div>
              <Icon name="phone" />
              <Icon name="more" />
            </header>
            <div className="reply-phone-chat">
              <div className="bubble out">
                <p dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <span className="bubble-meta">
                  10:24
                  <Icon name="checks" />
                </span>
              </div>
            </div>
            <div className="reply-phone-composer">
              <Icon name="smile" />
              <span>Escribe un mensaje…</span>
              <Icon name="paperclip" />
              <em>
                <Icon name="send" />
              </em>
            </div>
          </div>
          <footer>
            <span>Respuesta: {draft.title || "Sin título"}</span>
            <code>{shortcut}</code>
          </footer>
        </aside>
      </div>

      <footer className="pay-cfg-foot">
        <p>
          <em>*</em> Campos obligatorios
        </p>
        {error ? <p className="pay-cfg-error">{error}</p> : <span />}
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn" disabled={saving}>
          <Icon name="check-circle" />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </footer>
    </form>
  );
}
