"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { useAppPath } from "@/lib/app-path";

type Tag = {
  id: string;
  name: string;
  color?: string | null;
  _count?: { contacts: number; products: number; services: number };
};

type Contact = {
  id: string;
  name?: string | null;
  phone: string;
  tags?: { tag: { id: string } }[];
};

type Filter = "all" | "used" | "empty";
type SortKey = "name" | "contacts" | "color";

const SWATCHES = [
  "#A9ABAC",
  "#546E7A",
  "#00897B",
  "#1565C0",
  "#5E35B1",
  "#6D9CE6",
  "#64C4FF",
  "#FF7B5A",
  "#FF9485",
  "#FB8C00",
  "#FFD429",
  "#B5E36A",
  "#5DD8C0",
  "#D3A3FF",
];

function normalizeHex(value?: string | null) {
  const raw = (value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  return "#128C7E";
}

function chipStyle(color?: string | null) {
  const hex = normalizeHex(color);
  const n = hex.slice(1);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return { background: `rgba(${r},${g},${b},0.16)`, color: hex };
}

export default function TagsPage() {
  const { navigate } = useAppPath();
  const { ask } = useConfirm();
  const { data: items, reload, setData } = useApiGet<Tag[]>("/tags");
  const { data: contacts } = useApiGet<Contact[]>("/contacts");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Tag | null>(null);
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState("");

  const source = items ?? [];
  const taggedContacts = (contacts ?? []).filter((c) => (c.tags ?? []).length > 0).length;
  const withContacts = source.filter((t) => (t._count?.contacts ?? 0) > 0).length;
  const withoutContacts = source.length - withContacts;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = source.filter((t) => {
      const count = t._count?.contacts ?? 0;
      if (filter === "used" && count === 0) return false;
      if (filter === "empty" && count > 0) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || (t.color || "").toLowerCase().includes(q);
    });
    return rows.sort((a, b) => {
      if (sort === "contacts") return (b._count?.contacts ?? 0) - (a._count?.contacts ?? 0);
      if (sort === "color") return normalizeHex(a.color).localeCompare(normalizeHex(b.color));
      return a.name.localeCompare(b.name, "es");
    });
  }, [filter, search, sort, source]);

  function openForm(tag?: Tag) {
    setMenuId(null);
    setDraft(
      tag ?? {
        id: "",
        name: "",
        color: "#FF7B5A",
        _count: { contacts: 0, products: 0, services: 0 },
      },
    );
  }

  async function importWhatsApp() {
    setImporting(true);
    setNote("");
    try {
      const result = await api<{ source: string; created: number; items: Tag[] }>("/tags/whatsapp", {
        method: "POST",
      });
      setData(result.items);
      setNote(
        result.source === "meta"
          ? `Trajimos ${result.created} etiquetas desde WhatsApp Business.`
          : result.created
            ? `Listas las etiquetas de WhatsApp Business (${result.created} nuevas).`
            : "Ya tenías las etiquetas de WhatsApp Business.",
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : "No se pudieron traer las etiquetas");
    } finally {
      setImporting(false);
    }
  }

  async function remove(tag: Tag) {
    const ok = await ask({
      title: `¿Borrar ${tag.name}?`,
      body: "Se quita de los contactos y del catálogo que la tenían.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    await api(`/tags/${tag.id}`, { method: "DELETE" });
    setMenuId(null);
    if (draft?.id === tag.id) setDraft(null);
    await reload();
  }

  return (
    <div className="tags-page">
      <PageHeader
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => void importWhatsApp()} disabled={importing}>
              <Icon name="whatsapp" />
              {importing ? "Importando…" : "Importar de WhatsApp"}
            </button>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Nueva etiqueta
            </button>
          </>
        }
      />

      <p className="tags-meta">
        {source.length} etiqueta{source.length === 1 ? "" : "s"} · {taggedContacts} contacto
        {taggedContacts === 1 ? "" : "s"} etiquetado{taggedContacts === 1 ? "" : "s"}
      </p>
      {note ? <p className="muted tags-note">{note}</p> : null}

      <div className="catalog-tabs" role="tablist" aria-label="Estado de las etiquetas">
        {(
          [
            ["all", "Todas", source.length],
            ["used", "Con contactos", withContacts],
            ["empty", "Sin contactos", withoutContacts],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label} <span className="muted">{count}</span>
          </button>
        ))}
      </div>

      <div className="card catalog-card">
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <Icon name="search" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar etiqueta…"
              aria-label="Buscar etiqueta"
            />
          </label>
          <label className="catalog-filter-row">
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar etiquetas">
              <option value="name">Ordenar por nombre</option>
              <option value="contacts">Ordenar por contactos</option>
              <option value="color">Ordenar por color</option>
            </select>
          </label>
        </div>
        {items === null && <LoadingState compact label="Cargando etiquetas…" />}
        {items && !filtered.length && (
          <EmptyState
            title={source.length ? "Sin coincidencias" : "Aún no hay etiquetas"}
            body={
              source.length
                ? "Prueba otro nombre o cambia el filtro."
                : "Impórtalas de WhatsApp o crea una para marcar a tus contactos."
            }
          />
        )}
        {filtered.length > 0 && (
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Etiqueta</th>
                  <th>Color</th>
                  <th>Contactos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tag) => {
                  const count = tag._count?.contacts ?? 0;
                  return (
                    <tr key={tag.id}>
                      <td>
                        <span className="tag-chip" style={chipStyle(tag.color)}>
                          <i style={{ background: normalizeHex(tag.color) }} />
                          {tag.name}
                        </span>
                      </td>
                      <td className="tag-hex">{normalizeHex(tag.color)}</td>
                      <td>
                        {count > 0 ? (
                          <button type="button" className="tag-count-link" onClick={() => navigate(`/contacts?tag=${tag.id}`)}>
                            {count} contacto{count === 1 ? "" : "s"}
                            <Icon name="chevron-right" />
                          </button>
                        ) : (
                          <span>0 contactos</span>
                        )}
                      </td>
                      <td>
                        <div className="catalog-actions">
                          <button type="button" className="icon-btn" aria-label={`Editar ${tag.name}`} onClick={() => openForm(tag)}>
                            <Icon name="pencil" />
                          </button>
                          <div className="catalog-more">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Más acciones de ${tag.name}`}
                              onClick={() => setMenuId((id) => (id === tag.id ? null : tag.id))}
                            >
                              <Icon name="more" />
                            </button>
                            {menuId === tag.id ? (
                              <div className="inbox-pop">
                                <button type="button" onClick={() => openForm(tag)}>
                                  Editar
                                </button>
                                <button type="button" onClick={() => void remove(tag)}>
                                  Borrar
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <footer className="catalog-pager">
              <p>
                Mostrando {filtered.length} etiqueta{filtered.length === 1 ? "" : "s"}
              </p>
              <div className="pager-btns">
                <button type="button" className="on">
                  1
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>

      {draft ? (
        <TagDrawer
          tag={draft}
          contacts={(contacts ?? []).filter((c) => (c.tags ?? []).some((row) => row.tag.id === draft.id))}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}

function TagDrawer({
  tag,
  contacts,
  onClose,
  onSaved,
}: {
  tag: Tag;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { navigate } = useAppPath();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(normalizeHex(tag.color));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !tag.id;
  const selected = normalizeHex(color);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = { name: name.trim(), color: selected };
    try {
      if (isNew) await api("/tags", { method: "POST", body: JSON.stringify(body) });
      else await api(`/tags/${tag.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <div className="drawer tag-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="tag-form-title">
        <div className="drawer-head">
          <div>
            <h2 id="tag-form-title">{isNew ? "Nueva etiqueta" : "Editar etiqueta"}</h2>
            <p>Define cómo identificarás a tus contactos.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)}>
          <section className="pay-cfg-block">
            <label className="pay-cfg-span">
              <span>Nombre de la etiqueta</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nuevo cliente" />
            </label>
            <div className="tag-color-field">
              <span>Color de la etiqueta</span>
              <p>Elige un color para reconocerla rápidamente.</p>
              <div className="tag-swatches" role="listbox" aria-label="Colores">
                {SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    role="option"
                    aria-selected={selected === hex}
                    className={`tag-swatch${selected === hex ? " on" : ""}`}
                    style={{ background: hex }}
                    onClick={() => setColor(hex)}
                    aria-label={hex}
                  />
                ))}
              </div>
            </div>
            <label className="pay-cfg-span">
              <span>Color personalizado</span>
              <div className="tag-custom-color">
                <i style={{ background: selected }} />
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  spellCheck={false}
                  aria-label="Color hexadecimal"
                />
              </div>
            </label>
            <div className="tag-preview">
              <span>Vista previa</span>
              <em className="tag-chip" style={chipStyle(selected)}>
                <i style={{ background: selected }} />
                {name.trim() || "Nombre de la etiqueta"}
              </em>
              <p>Así aparecerá en contactos y conversaciones.</p>
            </div>
          </section>

          {!isNew ? (
            <section className="tag-assoc">
              <div>
                <Icon name="user" />
                <div>
                  <strong>Contactos asociados</strong>
                  <p>
                    {contacts.length} contacto{contacts.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {contacts.length > 0 ? (
                <button
                  type="button"
                  className="tag-count-link"
                  onClick={() => {
                    onClose();
                    navigate(`/contacts?tag=${tag.id}`);
                  }}
                >
                  Ver contacto{contacts.length === 1 ? "" : "s"}
                  <Icon name="chevron-right" />
                </button>
              ) : (
                <p className="muted">Aún no la usa ningún contacto.</p>
              )}
            </section>
          ) : null}

          <div className="pay-cfg-foot">
            {error ? <p><em>{error}</em></p> : <p />}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn" disabled={saving || !name.trim()}>
              {saving ? "Guardando…" : isNew ? "Crear etiqueta" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
