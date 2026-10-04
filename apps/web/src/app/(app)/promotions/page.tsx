"use client";

import { FormEvent, useMemo, useState } from "react";
import { api, apiUpload, mediaUrl } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { formatMoney } from "@/lib/money";

type DiscountType = "PERCENT" | "FIXED" | "BOGO";
type StatusFilter = "all" | "active" | "scheduled" | "paused";

type PromoItem = {
  id: string;
  productId?: string | null;
  serviceId?: string | null;
  product?: { id: string; name: string } | null;
  service?: { id: string; name: string } | null;
};

type Promo = {
  id: string;
  name: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: string;
  code?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  imageUrls?: string[];
  items?: PromoItem[];
  demo?: boolean;
};

type CatalogItem = { id: string; name: string; isActive?: boolean };

type PromoStatus = "active" | "scheduled" | "paused" | "ended";

const SAMPLES: Promo[] = [
  {
    id: "demo-lago",
    name: "Lago entre semana",
    description: "15% en acampar de lunes a jueves.",
    discountType: "PERCENT",
    discountValue: "15",
    code: "LAGO",
    isActive: true,
    demo: true,
    items: [{ id: "i1", service: { id: "s1", name: "Acampar" } }],
  },
  {
    id: "demo-bote",
    name: "2x1 en botes",
    description: "Dos personas reman por el precio de una.",
    discountType: "BOGO",
    discountValue: "1",
    code: "BOTE",
    isActive: true,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-31T23:59:59.000Z",
    demo: true,
    items: [{ id: "i2", service: { id: "s2", name: "Botes a remo" } }],
  },
];

function promoStatus(p: Promo, now = Date.now()): PromoStatus {
  if (!p.isActive) return "paused";
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return "scheduled";
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return "ended";
  return "active";
}

function statusLabel(status: PromoStatus) {
  if (status === "scheduled") return "Programada";
  if (status === "paused") return "Pausada";
  if (status === "ended") return "Vencida";
  return "Activa";
}

function benefitLabel(p: Promo) {
  if (p.discountType === "BOGO") return "2x1";
  if (p.discountType === "PERCENT") return `${Number(p.discountValue)}%`;
  return formatMoney(p.discountValue);
}

function rangeLabel(p: Promo) {
  if (!p.startsAt && !p.endsAt) return "Sin vencimiento";
  const start = p.startsAt ? formatDay(p.startsAt) : "Hoy";
  const end = p.endsAt ? formatDay(p.endsAt) : "Sin fin";
  return `${start} – ${end}`;
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string, end = false) {
  if (!value) return null;
  return new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`).toISOString();
}

function applyValue(p: Promo) {
  const item = p.items?.[0];
  if (item?.serviceId || item?.service?.id) return `s:${item.serviceId || item.service?.id}`;
  if (item?.productId || item?.product?.id) return `p:${item.productId || item.product?.id}`;
  return "";
}

function applyLabel(p: Promo) {
  const item = p.items?.[0];
  return item?.service?.name || item?.product?.name || "Todas las experiencias";
}

export default function PromotionsPage() {
  const { ask } = useConfirm();
  const { data: items, reload } = useApiGet<Promo[]>("/promotions");
  const { data: services } = useApiGet<CatalogItem[]>("/services");
  const { data: products } = useApiGet<CatalogItem[]>("/products");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [examples, setExamples] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Promo | null>(null);

  const source = useMemo(() => {
    const real = items ?? [];
    return examples ? [...real, ...SAMPLES] : real;
  }, [examples, items]);

  const now = Date.now();
  const counts = useMemo(() => {
    const statuses = source.map((p) => promoStatus(p, now));
    return {
      all: source.length,
      active: statuses.filter((s) => s === "active").length,
      scheduled: statuses.filter((s) => s === "scheduled").length,
      paused: statuses.filter((s) => s === "paused" || s === "ended").length,
    };
  }, [now, source]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return source.filter((p) => {
      const status = promoStatus(p, now);
      if (filter === "active" && status !== "active") return false;
      if (filter === "scheduled" && status !== "scheduled") return false;
      if (filter === "paused" && status !== "paused" && status !== "ended") return false;
      if (!q) return true;
      return [p.name, p.description, p.code, applyLabel(p)].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [filter, now, search, source]);

  function openForm(promo?: Promo) {
    setMenuId(null);
    if (promo?.demo) {
      setDraft({
        ...promo,
        id: "",
        demo: false,
        items: [],
      });
      return;
    }
    setDraft(
      promo
        ? { ...promo }
        : {
            id: "",
            name: "",
            description: "",
            discountType: "PERCENT",
            discountValue: "15",
            code: "",
            isActive: true,
            imageUrls: [],
            items: [],
          },
    );
  }

  async function remove(promo: Promo) {
    if (promo.demo) return;
    const ok = await ask({
      title: `¿Borrar ${promo.name}?`,
      body: "El asistente deja de ofrecerla.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    await api(`/promotions/${promo.id}`, { method: "DELETE" });
    setMenuId(null);
    if (draft?.id === promo.id) setDraft(null);
    await reload();
  }

  async function toggle(promo: Promo) {
    if (promo.demo) return;
    await api(`/promotions/${promo.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: promo.name,
        description: promo.description ?? null,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue) || 0,
        code: promo.code ?? null,
        startsAt: promo.startsAt ?? null,
        endsAt: promo.endsAt ?? null,
        isActive: !promo.isActive,
        imageUrls: promo.imageUrls ?? [],
        serviceIds: promo.items?.map((i) => i.serviceId || i.service?.id).filter(Boolean) ?? [],
        productIds: promo.items?.map((i) => i.productId || i.product?.id).filter(Boolean) ?? [],
      }),
    });
    setMenuId(null);
    await reload();
  }

  return (
    <div className="promo-page">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
              <span>Datos de ejemplo</span>
            </label>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Nueva promoción
            </button>
          </>
        }
      />

      <div className="promo-stats">
        <article>
          <Icon name="check-circle" />
          <div>
            <strong>{counts.active}</strong>
            <p>Activas</p>
          </div>
        </article>
        <article>
          <Icon name="calendar" />
          <div>
            <strong>{counts.scheduled}</strong>
            <p>Programadas</p>
          </div>
        </article>
        <article>
          <Icon name="hourglass" />
          <div>
            <strong>{counts.paused}</strong>
            <p>Pausadas</p>
          </div>
        </article>
      </div>

      <div className="catalog-tabs" role="tablist" aria-label="Estado de las promociones">
        {(
          [
            ["all", "Todas", counts.all],
            ["active", "Activas", counts.active],
            ["scheduled", "Programadas", counts.scheduled],
            ["paused", "Pausadas", counts.paused],
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
              placeholder="Buscar promoción…"
              aria-label="Buscar promoción"
            />
          </label>
        </div>
        {items === null && <LoadingState compact label="Cargando promociones…" />}
        {items && !filtered.length && (
          <EmptyState
            title={source.length ? "Sin coincidencias" : "Aún no hay promociones"}
            body={source.length ? "Prueba otro nombre o cambia el filtro." : "Crea una oferta. El asistente la mencionará cuando encaje."}
          />
        )}
        {filtered.length > 0 && (
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Promoción</th>
                  <th>Beneficio</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((promo) => {
                  const status = promoStatus(promo, now);
                  return (
                    <tr key={promo.id} className={status === "paused" || status === "ended" ? "is-off" : ""}>
                      <td>
                        <div className="catalog-product">
                          {promo.imageUrls?.[0] ? (
                            <img src={mediaUrl(promo.imageUrls[0])} alt="" className="catalog-thumb" />
                          ) : (
                            <span className="product-symbol">
                              <Icon name="tag" />
                            </span>
                          )}
                          <div>
                            <strong>
                              {promo.name}
                              {promo.demo ? <i> Ejemplo</i> : null}
                            </strong>
                            <small>{applyLabel(promo)}</small>
                          </div>
                        </div>
                      </td>
                      <td className="nowrap">{benefitLabel(promo)}</td>
                      <td>{rangeLabel(promo)}</td>
                      <td>
                        <span className={`st-badge ${status === "active" ? "resolved" : status === "scheduled" ? "pending" : ""}`}>
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td>
                        <div className="catalog-actions">
                          <button type="button" className="icon-btn" aria-label={`Editar ${promo.name}`} onClick={() => openForm(promo)}>
                            <Icon name="pencil" />
                          </button>
                          {!promo.demo ? (
                            <div className="catalog-more">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Más acciones de ${promo.name}`}
                                onClick={() => setMenuId((id) => (id === promo.id ? null : promo.id))}
                              >
                                <Icon name="more" />
                              </button>
                              {menuId === promo.id ? (
                                <div className="inbox-pop">
                                  <button type="button" onClick={() => void toggle(promo)}>
                                    {promo.isActive ? "Pausar" : "Activar"}
                                  </button>
                                  <button type="button" onClick={() => void remove(promo)}>
                                    Borrar
                                  </button>
                                </div>
                              ) : null}
                            </div>
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
                {filtered.length} promoción{filtered.length === 1 ? "" : "es"}
              </p>
            </footer>
          </div>
        )}
      </div>

      {draft ? (
        <PromoDrawer
          promo={draft}
          services={services ?? []}
          products={products ?? []}
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

function PromoDrawer({
  promo,
  services,
  products,
  onClose,
  onSaved,
}: {
  promo: Promo;
  services: CatalogItem[];
  products: CatalogItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(promo.name);
  const [apply, setApply] = useState(applyValue(promo));
  const [kind, setKind] = useState<DiscountType>(promo.discountType);
  const [value, setValue] = useState(promo.discountType === "BOGO" ? "" : String(Number(promo.discountValue) || ""));
  const [code, setCode] = useState(promo.code ?? "");
  const [start, setStart] = useState(toDateInput(promo.startsAt));
  const [end, setEnd] = useState(toDateInput(promo.endsAt));
  const [description, setDescription] = useState(promo.description ?? "");
  const [isActive, setIsActive] = useState(promo.isActive);
  const [imageUrls, setImageUrls] = useState<string[]>(promo.imageUrls ?? []);
  const [imageDraft, setImageDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !promo.id;

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
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const serviceIds = apply.startsWith("s:") ? [apply.slice(2)] : [];
    const productIds = apply.startsWith("p:") ? [apply.slice(2)] : [];
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      discountType: kind,
      discountValue: kind === "BOGO" ? 1 : Number(value) || 0,
      code: code.trim() || null,
      startsAt: fromDateInput(start),
      endsAt: fromDateInput(end, true),
      isActive,
      imageUrls,
      serviceIds,
      productIds,
    };
    try {
      if (isNew) await api("/promotions", { method: "POST", body: JSON.stringify(body) });
      else await api(`/promotions/${promo.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <div className="drawer promo-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="promo-form-title">
        <div className="drawer-head">
          <div>
            <h2 id="promo-form-title">{isNew ? "Nueva promoción" : "Editar promoción"}</h2>
            <p>Configúrala y el asistente podrá recomendarla.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)}>
          <section className="pay-cfg-block">
            <h2>Información general</h2>
            <label className="pay-cfg-span">
              <span>Nombre de la promoción</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Lago entre semana" />
            </label>
            <label className="pay-cfg-span">
              <span>Aplicar a</span>
              <select value={apply} onChange={(e) => setApply(e.target.value)}>
                <option value="">Todas las experiencias</option>
                <optgroup label="Servicios">
                  {services.map((s) => (
                    <option key={s.id} value={`s:${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Productos">
                  {products.map((p) => (
                    <option key={p.id} value={`p:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </section>

          <section className="pay-cfg-block">
            <h2>Beneficio</h2>
            <div className="know-types" role="radiogroup" aria-label="Tipo de beneficio">
              {(
                [
                  ["PERCENT", "Porcentaje"],
                  ["FIXED", "Monto fijo"],
                  ["BOGO", "2x1"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={kind === id ? "on" : ""} aria-pressed={kind === id} onClick={() => setKind(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="pay-cfg-grid">
              {kind !== "BOGO" ? (
                <label>
                  <span>Descuento</span>
                  <span className="svc-suffix">
                    <input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required />
                    <em>{kind === "PERCENT" ? "%" : "USD"}</em>
                  </span>
                </label>
              ) : (
                <p className="reply-cfg-hint">El segundo entra sin costo. El asistente lo explica así.</p>
              )}
              <label>
                <span>Código opcional</span>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LAGO" />
              </label>
            </div>
          </section>

          <section className="pay-cfg-block">
            <h2>Vigencia</h2>
            <div className="pay-cfg-grid">
              <label>
                <span>Inicio</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                <span>Fin</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <small className="reply-cfg-hint">Si dejas las fechas vacías, queda vigente hasta que la pauses.</small>
          </section>

          <section className="pay-cfg-block">
            <h2>Condiciones</h2>
            <label className="pay-cfg-span">
              <span>Texto que puede citar el asistente</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="15% en acampar de lunes a jueves."
              />
            </label>
          </section>

          <section className="pay-cfg-block">
            <h2>Fotos</h2>
            <p className="reply-cfg-hint">Opcional. El asistente las envía si piden ver la promo o las instalaciones.</p>
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
                <input value={imageDraft} onChange={(e) => setImageDraft(e.target.value)} placeholder="https://… o pega un enlace" />
              </label>
              <button className="btn ghost" type="button" onClick={() => void addImageUrl()}>
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
          </section>

          <div className="pay-cfg-active">
            <button
              type="button"
              className="pay-switch"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              aria-label={isActive ? "Pausar promoción" : "Activar promoción"}
            >
              <i />
            </button>
            <div>
              <strong>Disponible para el asistente</strong>
              <p>Si está apagada, no la recomienda aunque pregunten por ofertas.</p>
            </div>
          </div>

          {error ? <p className="pay-cfg-error">{error}</p> : null}
          <div className="pay-cfg-foot">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn" disabled={saving}>
              {saving ? "Guardando…" : isNew ? "Publicar" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
