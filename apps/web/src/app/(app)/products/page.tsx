"use client";

import { FormEvent, useMemo, useState } from "react";
import { api, apiUpload, mediaUrl } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { formatMoney, WORKSPACE_CURRENCY } from "@/lib/money";
import { useConfirm } from "@/components/confirm-dialog";

type ProductLink = { label: string; url: string };
type Category = { id: string; name: string };
type Price = { id: string; amount: string; currency: string; label: string; isDefault?: boolean };

type Product = {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  isActive: boolean;
  isAddon?: boolean;
  stock?: number | null;
  parentServiceId?: string | null;
  parentService?: { id: string; name: string } | null;
  categoryId?: string | null;
  category?: Category | null;
  imageUrls?: string[];
  links?: ProductLink[];
  prices: Price[];
};

type ServiceOption = { id: string; name: string; isActive: boolean };

const PAGE_SIZE = 5;

export default function ProductsPage() {
  const { data: items, reload } = useApiGet<Product[]>("/products");
  const { data: categories, reload: reloadCats } = useApiGet<Category[]>("/categories");
  const { data: services } = useApiGet<ServiceOption[]>("/services");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageDraft, setImageDraft] = useState("");
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [linkDraft, setLinkDraft] = useState({ label: "", url: "" });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const { ask } = useConfirm();

  function openForm(product: Product | null) {
    setEditing(product);
    setImageUrls(product?.imageUrls ?? []);
    setLinks(product?.links ?? []);
    setImageDraft("");
    setLinkDraft({ label: "", url: "" });
    setError("");
    setFormOpen(true);
    setMenuId(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setError("");
  }

  async function addImageUrl() {
    const url = imageDraft.trim();
    if (!url) return;
    setImageUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setImageDraft("");
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await apiUpload<{ url: string }>("/uploads/images", file);
      setImageUrls((prev) => [...prev, res.url]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function addLink() {
    const label = linkDraft.label.trim();
    const url = linkDraft.url.trim();
    if (!label || !url) return;
    setLinks((prev) => [...prev, { label, url }]);
    setLinkDraft({ label: "", url: "" });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    let categoryId = String(form.get("categoryId") || "") || null;
    const newCategory = String(form.get("newCategory") || "").trim();
    try {
      if (newCategory) {
        const created = await api<Category>("/categories", {
          method: "POST",
          body: JSON.stringify({ name: newCategory }),
        });
        categoryId = created.id;
        reloadCats();
      }
      const payload = {
        name: String(form.get("name")),
        description: String(form.get("description") || "") || null,
        sku: String(form.get("sku") || "") || null,
        categoryId,
        isActive: form.get("isActive") === "on",
        isAddon: form.get("isAddon") === "on",
        stock: form.get("stock") === "" ? null : Number(form.get("stock")),
        parentServiceId: String(form.get("parentServiceId") || "") || null,
        imageUrls,
        links,
      };
      const product = editing
        ? await api<Product>(`/products/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<Product>("/products", { method: "POST", body: JSON.stringify(payload) });
      const amount = Number(form.get("amount"));
      if (amount > 0) {
        await api("/prices", {
          method: "POST",
          body: JSON.stringify({
            productId: product.id,
            amount,
            currency: form.get("currency") || WORKSPACE_CURRENCY,
            label: "regular",
            isDefault: true,
          }),
        });
      }
      closeForm();
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((p) => {
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "hidden" && p.isActive) return false;
      if (categoryFilter && p.categoryId !== categoryFilter && p.category?.id !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, categoryFilter, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="catalog-page">
      <PageHeader
        actions={
          <button className="btn" type="button" onClick={() => openForm(null)}>
            <Icon name="plus" /> Nuevo producto
          </button>
        }
      />

      <div className="catalog-tabs" role="tablist" aria-label="Estado del catálogo">
        {(
          [
            ["all", "Todos", items?.length ?? 0],
            ["active", "Activos", items?.filter((p) => p.isActive).length ?? 0],
            ["hidden", "Ocultos", items?.filter((p) => !p.isActive).length ?? 0],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={statusFilter === value}
            className={statusFilter === value ? "active" : ""}
            onClick={() => {
              setStatusFilter(value);
              setPage(1);
            }}
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre o código…"
              aria-label="Buscar productos"
            />
          </label>
          <div className="catalog-filter-row">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {items === null && <LoadingState compact label="Cargando productos…" />}
        {items && !items.length && (
          <EmptyState
            title="Sin productos"
            body="Crea el primero. El bot lo usará para responder precios, fotos y enlaces."
          />
        )}
        {items && items.length > 0 && !filtered.length && (
          <EmptyState title="Sin coincidencias" body="Prueba otro nombre o cambia la categoría." />
        )}
        {slice.length > 0 && (
          <>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="catalog-product">
                          {p.imageUrls?.[0] ? (
                            <img src={mediaUrl(p.imageUrls[0])} alt="" className="catalog-thumb" />
                          ) : (
                            <span className="product-symbol">
                              <Icon name="box" />
                            </span>
                          )}
                          <div>
                            <strong>{p.name}</strong>
                            <small>
                              {p.isAddon
                                ? `Complemento${p.parentService?.name ? ` de ${p.parentService.name}` : ""}${
                                    p.stock != null ? ` · stock ${p.stock}` : ""
                                  }`
                                : p.sku
                                  ? `SKU ${p.sku}`
                                  : p.description || "Sin código"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{p.category?.name || "—"}</td>
                      <td className="nowrap">{formatPrice(p.prices)}</td>
                      <td>
                        <span className={`st-badge ${p.isActive ? "resolved" : "pending"}`}>
                          {p.isAddon ? "Complemento" : p.isActive ? "Activo" : "Oculto"}
                        </span>
                      </td>
                      <td>
                        <div className="catalog-actions">
                          <button type="button" className="icon-btn" aria-label={`Editar ${p.name}`} onClick={() => openForm(p)}>
                            <Icon name="pencil" />
                          </button>
                          <div className="catalog-more">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Más acciones de ${p.name}`}
                              onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                            >
                              <Icon name="more" />
                            </button>
                            {menuId === p.id && (
                              <div className="inbox-pop">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api(`/products/${p.id}`, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        name: p.name,
                                        description: p.description,
                                        sku: p.sku,
                                        categoryId: p.categoryId ?? p.category?.id ?? null,
                                        isActive: !p.isActive,
                                        isAddon: p.isAddon ?? false,
                                        stock: p.stock ?? null,
                                        parentServiceId: p.parentServiceId ?? p.parentService?.id ?? null,
                                        imageUrls: p.imageUrls ?? [],
                                        links: p.links ?? [],
                                      }),
                                    });
                                    setMenuId(null);
                                    reload();
                                  }}
                                >
                                  {p.isActive ? "Ocultar al bot" : "Marcar activo"}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await ask({
                                      title: `¿Borrar ${p.name}?`,
                                      body: "Desaparece del catálogo y el asistente ya no lo mencionará.",
                                      confirmLabel: "Borrar",
                                    });
                                    if (!ok) return;
                                    await api(`/products/${p.id}`, { method: "DELETE" });
                                    setMenuId(null);
                                    reload();
                                  }}
                                >
                                  Borrar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="catalog-pager">
              <p>
                Mostrando {from}–{to} de {filtered.length} productos
              </p>
              <div className="pager-btns">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  ‹
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={n === safePage ? "on" : ""} onClick={() => setPage(n)}>
                    {n}
                  </button>
                ))}
                <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>
                  ›
                </button>
              </div>
            </footer>
          </>
        )}
      </div>

      {formOpen && (
        <div className="drawer-back" onClick={closeForm}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="product-form-title">
            <div className="drawer-head">
              <h2 id="product-form-title">{editing ? `Editar ${editing.name}` : "Nuevo producto"}</h2>
              <button type="button" className="icon-btn" onClick={closeForm} aria-label="Cerrar">
                ×
              </button>
            </div>
            <form key={editing?.id ?? "new"} onSubmit={onSubmit}>
              <div className="row">
                <label style={{ flex: 2 }}>
                  <span>Nombre</span>
                  <input name="name" required defaultValue={editing?.name} placeholder="Crema hidratante" />
                </label>
                <label style={{ flex: 1 }}>
                  <span>SKU</span>
                  <input name="sku" defaultValue={editing?.sku ?? ""} placeholder="CRE-01" />
                </label>
              </div>
              <div className="row">
                <label style={{ flex: 1 }}>
                  <span>Categoría</span>
                  <select name="categoryId" defaultValue={editing?.categoryId ?? editing?.category?.id ?? ""}>
                    <option value="">Sin categoría</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  <span>O crea una</span>
                  <input name="newCategory" placeholder="Consultoría" />
                </label>
              </div>
              <div className="row">
                <label style={{ flex: 1 }}>
                  <span>Precio</span>
                  <span className="svc-suffix">
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={editing?.prices[0]?.amount ?? "89.00"}
                    />
                    <em>USD</em>
                  </span>
                  <input type="hidden" name="currency" value={WORKSPACE_CURRENCY} />
                  <small className="reply-cfg-hint">Los precios van en dólares.</small>
                </label>
              </div>
              <label>
                <span>Descripción para el bot</span>
                <textarea name="description" rows={2} defaultValue={editing?.description ?? ""} />
              </label>
              <label className="check">
                <input name="isAddon" type="checkbox" defaultChecked={editing?.isAddon ?? false} />
                <span>Complemento de un servicio (no se ofrece como producto principal)</span>
              </label>
              <div className="row">
                <label style={{ flex: 2 }}>
                  <span>Servicio padre</span>
                  <select name="parentServiceId" defaultValue={editing?.parentServiceId ?? editing?.parentService?.id ?? ""}>
                    <option value="">Ninguno</option>
                    {(services ?? [])
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label style={{ width: 120 }}>
                  <span>Stock</span>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    placeholder="5"
                    defaultValue={editing?.stock ?? ""}
                  />
                </label>
              </div>

              <div className="media-block">
                <p className="media-label">Imágenes</p>
                <div className="media-grid">
                  {imageUrls.map((url) => (
                    <div key={url} className="thumb-wrap">
                      <img src={mediaUrl(url)} alt="" className="thumb" />
                      <button type="button" className="thumb-x" onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="row">
                  <label style={{ flex: 1 }}>
                    <span>URL de la imagen</span>
                    <input
                      value={imageDraft}
                      onChange={(e) => setImageDraft(e.target.value)}
                      placeholder="https://… o pega un enlace"
                    />
                  </label>
                  <button className="btn ghost" type="button" onClick={addImageUrl}>
                    Añadir URL
                  </button>
                  <label className="btn ghost file-btn">
                    {uploading ? "Subiendo…" : "Subir archivo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      disabled={uploading}
                      onChange={(e) => {
                        void onUpload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="media-block">
                <p className="media-label">Enlaces</p>
                {links.map((link, i) => (
                  <div key={`${link.url}-${i}`} className="link-row">
                    <a href={mediaUrl(link.url)} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                    <span className="muted">{link.url}</span>
                    <button type="button" className="btn ghost" onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}>
                      Quitar
                    </button>
                  </div>
                ))}
                <div className="row">
                  <label style={{ flex: 1 }}>
                    <span>Texto del enlace</span>
                    <input
                      value={linkDraft.label}
                      onChange={(e) => setLinkDraft((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Ver en la tienda"
                    />
                  </label>
                  <label style={{ flex: 2 }}>
                    <span>URL</span>
                    <input
                      value={linkDraft.url}
                      onChange={(e) => setLinkDraft((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://tu-tienda.com/producto"
                    />
                  </label>
                  <button className="btn ghost" type="button" onClick={addLink}>
                    Añadir enlace
                  </button>
                </div>
              </div>

              <label className="check">
                <input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} />
                <span>Visible para el bot</span>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="row">
                <button className="btn success">{editing ? "Guardar cambios" : "Crear producto"}</button>
                <button className="btn ghost" type="button" onClick={closeForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPrice(prices: Price[]) {
  const p = prices.find((x) => x.isDefault) ?? prices[0];
  if (!p) return "—";
  return formatMoney(p.amount, p.currency);
}
