"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { useAppPath } from "@/lib/app-path";
import { useMounted } from "@/lib/use-mounted";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { formatMoney, WORKSPACE_CURRENCY } from "@/lib/money";
import { ServiceConfig, type ServiceDraft } from "./service-config";

type Service = ServiceDraft & { demo?: boolean };
type Company = { id: string; name?: string };

const SAMPLES: Service[] = [
  {
    id: "demo-acamp",
    name: "Acampar",
    description: "Reserva para acampar con equipamiento opcional.",
    durationMinutes: 60,
    isActive: true,
    demo: true,
    prices: [{ id: "p1", amount: "80", currency: WORKSPACE_CURRENCY, label: "regular", isDefault: true }],
  },
  {
    id: "demo-bote",
    name: "Paseo en bote",
    description: "Recorrido por el lago.",
    durationMinutes: 30,
    isActive: true,
    demo: true,
    prices: [{ id: "p2", amount: "35", currency: WORKSPACE_CURRENCY, label: "regular", isDefault: true }],
  },
  {
    id: "demo-pesca",
    name: "Pesca recreativa",
    description: "Experiencia de pesca en el lago.",
    durationMinutes: 60,
    isActive: true,
    demo: true,
    prices: [{ id: "p3", amount: "25", currency: WORKSPACE_CURRENCY, label: "regular", isDefault: true }],
  },
  {
    id: "demo-tour",
    name: "Recorrido guiado",
    description: "Caminata para conocer el lugar.",
    durationMinutes: 45,
    isActive: false,
    demo: true,
    prices: [{ id: "p4", amount: "30", currency: WORKSPACE_CURRENCY, label: "regular", isDefault: true }],
  },
];

function emptyDraft(): Service {
  return { id: "", name: "", description: "", durationMinutes: 30, isActive: true, imageUrls: [], prices: [] };
}

function priceOf(service: Service) {
  return service.prices.find((p) => p.isDefault) ?? service.prices[0] ?? null;
}

function formatPrice(service: Service) {
  const price = priceOf(service);
  if (!price) return "—";
  const amount = Number(price.amount);
  if (!Number.isFinite(amount)) return "—";
  return formatMoney(amount, price.currency);
}

function serviceIcon(name: string) {
  const n = name.toLowerCase();
  if (/acamp|tienda|carpa|glamp|tent/.test(n)) return "tent";
  if (/bote|kayak|lancha|barco|nave/.test(n)) return "boat";
  if (/pesc/.test(n)) return "fish";
  if (/recorr|guiad|camin|tour|visita|mapa/.test(n)) return "map";
  return "spark";
}

export default function ServicesPage() {
  const mounted = useMounted();
  const { path, query: urlQuery, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<Service[]>("/services");
  const { data: company } = useApiGet<Company>("/companies/current");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [examples, setExamples] = useState(false);
  const [draft, setDraft] = useState<Service | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { ask } = useConfirm();
  const editKey = path === "/services" ? urlQuery.get("edit") : null;
  const configuring = editKey != null;

  const source = useMemo(() => {
    const real = items ?? [];
    return examples ? [...real, ...SAMPLES] : real;
  }, [examples, items]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return source.filter((service) => {
      if (filter === "active" && !service.isActive) return false;
      if (filter === "inactive" && service.isActive) return false;
      if (!q) return true;
      return [service.name, service.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, searchText, source]);

  const counts = useMemo(
    () => ({
      all: source.length,
      active: source.filter((s) => s.isActive).length,
      inactive: source.filter((s) => !s.isActive).length,
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
    const found = items.find((service) => service.id === editKey);
    if (!found) {
      navigate("/services");
      return;
    }
    setDraft((current) => (current?.id === found.id ? current : { ...found }));
  }, [configuring, editKey, items, navigate]);

  function openForm(service?: Service) {
    setMenuId(null);
    if (service?.demo) {
      setDraft({ ...emptyDraft(), ...service, id: "", demo: false, prices: [] });
      navigate("/services?edit=new");
      return;
    }
    setDraft(service ? { ...service } : emptyDraft());
    navigate(service?.id ? `/services?edit=${service.id}` : "/services?edit=new");
  }

  function closeForm() {
    setDraft(null);
    navigate("/services");
  }

  async function toggleActive(service: Service) {
    if (service.demo) return;
    await api(`/services/${service.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: service.name,
        description: service.description ?? null,
        durationMinutes: service.durationMinutes ?? null,
        isActive: !service.isActive,
      }),
    });
    await reload();
  }

  async function remove(service: Service) {
    if (service.demo) return;
    const ok = await ask({
      title: `¿Quitar ${service.name}?`,
      body: "Dejará de ofrecerse en WhatsApp. Puedes volver a crearlo después.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    await api(`/services/${service.id}`, { method: "DELETE" });
    setMenuId(null);
    await reload();
  }

  if (!mounted) return <LoadingState label="Cargando servicios…" />;

  if (configuring) {
    if (!draft) return <LoadingState label="Cargando servicio…" />;
    return (
      <ServiceConfig
        key={draft.id || "new"}
        service={draft}
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
    <div className="svc-page">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
              <span>Datos de ejemplo</span>
            </label>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Agregar servicio
            </button>
          </>
        }
      />

      <div className="reply-toolbar">
        <label className="pay-search">
          <Icon name="search" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar un servicio…"
            aria-label="Buscar un servicio"
          />
        </label>
        <div className="pay-filters" role="tablist" aria-label="Filtrar servicios">
          {(
            [
              ["all", "Todos", counts.all],
              ["active", "Activos", counts.active],
              ["inactive", "Inactivos", counts.inactive],
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

      {items === null && <LoadingState compact label="Cargando servicios…" />}
      {items && !filtered.length && (
        <EmptyState
          title={source.length ? "Sin coincidencias" : "Aún no hay servicios"}
          body={
            source.length
              ? "Prueba otro nombre o cambia el filtro."
              : "Agrega experiencias. El asistente las ofrecerá por WhatsApp."
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="reply-table-wrap">
          <table className="reply-table svc-table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Duración</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((service) => {
                const open = openId === service.id;
                return (
                  <Fragment key={service.id}>
                    <tr className={service.isActive ? "" : "is-off"}>
                      <td>
                        <div className="reply-title">
                          <span className="reply-file">
                            {service.imageUrls?.[0] ? (
                              <img src={mediaUrl(service.imageUrls[0])} alt="" className="catalog-thumb" />
                            ) : (
                              <Icon name={serviceIcon(service.name)} />
                            )}
                          </span>
                          <div>
                            <strong>
                              {service.name}
                              {service.demo ? <i>Ejemplo</i> : null}
                            </strong>
                            <p>{service.description || "Sin descripción"}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="svc-meta">
                          <Icon name="clock" />
                          {service.durationMinutes ? `${service.durationMinutes} min` : "—"}
                        </span>
                      </td>
                      <td>{formatPrice(service)}</td>
                      <td>
                        <span className="svc-state">
                          <button
                            type="button"
                            className="pay-switch"
                            role="switch"
                            aria-checked={service.isActive}
                            disabled={service.demo}
                            onClick={() => void toggleActive(service)}
                            aria-label={service.isActive ? `Desactivar ${service.name}` : `Activar ${service.name}`}
                          >
                            <i />
                          </button>
                          {service.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="reply-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Vista previa de ${service.name}`}
                            onClick={() => openForm(service)}
                          >
                            <Icon name="eye" />
                          </button>
                          <button type="button" className="reply-edit" onClick={() => openForm(service)}>
                            <Icon name="pencil" />
                            Editar
                          </button>
                          {!service.demo ? (
                            <div className="catalog-more">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Más acciones de ${service.name}`}
                                onClick={() => setMenuId((id) => (id === service.id ? null : service.id))}
                              >
                                <Icon name="more" />
                              </button>
                              {menuId === service.id ? (
                                <div className="inbox-pop">
                                  <button type="button" onClick={() => void toggleActive(service)}>
                                    {service.isActive ? "Desactivar" : "Activar"}
                                  </button>
                                  <button type="button" onClick={() => void remove(service)}>
                                    Quitar
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="pay-more-spacer" />
                          )}
                          <button
                            type="button"
                            className={`icon-btn svc-expand${open ? " on" : ""}`}
                            aria-expanded={open}
                            aria-label={open ? "Ocultar descripción" : "Ver descripción"}
                            onClick={() => setOpenId((id) => (id === service.id ? null : service.id))}
                          >
                            <Icon name="chevron-down" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="svc-detail">
                        <td colSpan={5}>
                          <strong>Descripción para el asistente</strong>
                          <p>
                            {service.description ||
                              "Aún no hay una descripción. El asistente usará solo el nombre y el precio."}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <footer className="reply-foot">
            <p>
              Mostrando {filtered.length} servicio{filtered.length === 1 ? "" : "s"}
            </p>
            <p>El asistente usa la descripción para explicar cada servicio.</p>
          </footer>
        </div>
      )}
    </div>
  );
}
