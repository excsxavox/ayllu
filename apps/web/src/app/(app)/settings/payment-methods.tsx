"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { useAppPath } from "@/lib/app-path";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { useConfirm } from "@/components/confirm-dialog";
import { PaymentMethodConfig, type PaymentDraft } from "./payment-method-config";

type MethodType = "TRANSFER" | "CARD";
type VisualKind = "transfer" | "card" | "wallet" | "cash" | "deposit";

type Method = PaymentDraft & {
  demo?: boolean;
  kind?: VisualKind;
};

type Company = { name: string };

const SAMPLES: Method[] = [
  {
    id: "demo-pichincha",
    type: "TRANSFER",
    name: "Banco Pichincha",
    isActive: true,
    bank: "Pichincha",
    accountType: "Ahorros",
    accountNumber: "2200004821",
    accountHolder: "AYLLU Lago",
    demo: true,
    kind: "transfer",
  },
  {
    id: "demo-guayaquil",
    type: "TRANSFER",
    name: "Banco Guayaquil",
    isActive: true,
    bank: "Guayaquil",
    accountType: "Corriente",
    accountNumber: "1100009036",
    demo: true,
    kind: "transfer",
  },
  {
    id: "demo-card",
    type: "CARD",
    name: "Pago con tarjeta",
    isActive: true,
    paymentUrl: "https://pay.example.com/ayllu",
    notes: "Crédito y débito",
    demo: true,
    kind: "card",
  },
  {
    id: "demo-wallet",
    type: "CARD",
    name: "Billetera digital",
    isActive: false,
    paymentUrl: "https://pay.example.com/qr",
    notes: "QR de cobro",
    demo: true,
    kind: "wallet",
  },
  {
    id: "demo-deposit",
    type: "TRANSFER",
    name: "Depósito bancario",
    isActive: false,
    bank: "Pichincha",
    accountType: "Ahorros",
    accountNumber: "2200004821",
    demo: true,
    kind: "deposit",
  },
  {
    id: "demo-cash",
    type: "TRANSFER",
    name: "Efectivo en el local",
    isActive: true,
    accountNumber: "caja",
    notes: "Pago presencial",
    demo: true,
    kind: "cash",
  },
];

function kindOf(method: Method): VisualKind {
  if (method.kind) return method.kind;
  const blob = `${method.name} ${method.notes ?? ""} ${method.paymentUrl ?? ""}`.toLowerCase();
  if (method.type === "CARD" && /(qr|billetera|wallet)/.test(blob)) return "wallet";
  if (method.type === "CARD") return "card";
  if (/(efectivo|caja|presencial)/.test(blob)) return "cash";
  if (/(dep[oó]sito)/.test(blob)) return "deposit";
  return "transfer";
}

function typeLabel(kind: VisualKind) {
  if (kind === "card") return "Link de pago";
  if (kind === "wallet") return "Pago con QR";
  if (kind === "cash") return "Pago presencial";
  if (kind === "deposit") return "Depósito a cuenta";
  return "Transferencia bancaria";
}

function typeChip(kind: VisualKind) {
  if (kind === "card") return "Tarjeta";
  if (kind === "wallet") return "Billetera";
  if (kind === "cash") return "Efectivo";
  if (kind === "deposit") return "Depósito";
  return "Transferencia";
}

function iconName(kind: VisualKind) {
  if (kind === "card") return "card";
  if (kind === "wallet") return "wallet";
  if (kind === "cash") return "cash";
  if (kind === "deposit") return "building";
  return "building";
}

function maskAccount(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return value || "—";
  return `•••• ${digits.slice(-4)}`;
}

function detailLine(method: Method, kind: VisualKind) {
  if (kind === "card") return method.notes || "Crédito y débito";
  if (kind === "wallet") return method.notes || "QR de cobro";
  if (kind === "cash") return method.notes || "Disponible en el establecimiento";
  const left = method.accountType || (kind === "deposit" ? "Depósito" : "Cuenta");
  return `${left} · ${maskAccount(method.accountNumber)}`;
}

function emptyDraft(type: MethodType = "TRANSFER"): Method {
  return {
    id: "",
    type,
    name: "",
    isActive: true,
    bank: "",
    accountType: "",
    accountNumber: "",
    accountHolder: "",
    holderId: "",
    receiptEmail: "",
    paymentUrl: "",
    notes: "",
  };
}

export function PaymentMethods() {
  const { path, query: urlQuery, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<Method[]>("/payments");
  const { data: company } = useApiGet<Company>("/companies/current");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [examples, setExamples] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const { ask } = useConfirm();
  const [draft, setDraft] = useState<Method | null>(null);
  const editKey = path === "/payments" ? urlQuery.get("edit") : null;
  const configuring = editKey != null;

  const source = useMemo(() => {
    const real = items ?? [];
    return examples ? [...real, ...SAMPLES] : real;
  }, [examples, items]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return source.filter((method) => {
      if (filter === "active" && !method.isActive) return false;
      if (filter === "inactive" && method.isActive) return false;
      if (!q) return true;
      return [method.name, method.bank, method.accountType, method.notes, method.accountHolder]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, searchText, source]);

  const counts = useMemo(
    () => ({
      all: source.length,
      active: source.filter((m) => m.isActive).length,
      inactive: source.filter((m) => !m.isActive).length,
    }),
    [source],
  );

  const preview = useMemo(() => {
    const realActive = source.filter((m) => m.isActive && !m.demo);
    const from = examples ? source.filter((m) => m.isActive) : realActive;
    const chips = [...new Set(from.map((m) => typeChip(kindOf(m))))];
    const list = chips.join(", ").replace(/, ([^,]+)$/, " o $1");
    const text = from.length
      ? `Puedes pagar por ${list.toLowerCase()}. ¿Qué opción prefieres?`
      : "Aún no hay métodos activos. Un asesor te indica cómo pagar.";
    return { chips, text, usingDemo: examples };
  }, [examples, source]);

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
    const found = items.find((method) => method.id === editKey);
    if (!found) {
      navigate("/payments");
      return;
    }
    setDraft((current) => (current?.id === found.id ? current : { ...found }));
  }, [configuring, editKey, items, navigate]);

  function openForm(method?: Method) {
    setMenuId(null);
    if (method?.demo) {
      setDraft({ ...emptyDraft(method.type), ...method, id: "", demo: false });
      navigate("/payments?edit=new");
      return;
    }
    setDraft(method ? { ...method } : emptyDraft());
    navigate(method?.id ? `/payments?edit=${method.id}` : "/payments?edit=new");
  }

  function closeForm() {
    setDraft(null);
    navigate("/payments");
  }

  async function toggle(method: Method) {
    if (method.demo) return;
    await api(`/payments/${method.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...method, isActive: !method.isActive }),
    });
    await reload();
  }

  async function remove(method: Method) {
    if (method.demo) return;
    const ok = await ask({
      title: `¿Quitar ${method.name}?`,
      body: "Ya no se ofrecerá como forma de pago en WhatsApp.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    await api(`/payments/${method.id}`, { method: "DELETE" });
    setMenuId(null);
    await reload();
  }

  if (configuring) {
    if (!draft) return <LoadingState label="Cargando método…" />;
    return (
      <PaymentMethodConfig
        key={draft.id || "new"}
        method={draft}
        onCancel={closeForm}
        onSaved={() => {
          closeForm();
          void reload();
        }}
      />
    );
  }

  return (
    <div className="pay-page">
      <PageHeader
        actions={
          <>
            <label className="pay-example">
              <input
                type="checkbox"
                checked={examples}
                onChange={(e) => setExamples(e.target.checked)}
              />
              <span>Datos de ejemplo</span>
            </label>
            <button type="button" className="btn" onClick={() => openForm()}>
              <Icon name="plus" />
              Agregar método
            </button>
          </>
        }
      />

      <div className="pay-board">
        <div className="pay-main">
          <div className="pay-toolbar">
            <label className="pay-search">
              <Icon name="search" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar método de pago…"
                aria-label="Buscar método de pago"
              />
            </label>
            <div className="pay-filters" role="tablist" aria-label="Filtrar métodos">
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

          {items === null && <LoadingState compact label="Cargando métodos…" />}
          {items && !filtered.length && (
            <EmptyState
              title={source.length ? "Sin coincidencias" : "Aún no hay métodos"}
              body={
                source.length
                  ? "Prueba otro nombre o cambia el filtro."
                  : "Agrega una cuenta o un link. El bot solo comparte los que estén activos."
              }
            />
          )}

          {filtered.length > 0 && (
            <div className="pay-grid">
              {filtered.map((method) => {
                const kind = kindOf(method);
                return (
                  <article key={method.id} className={`pay-card${method.isActive ? "" : " is-off"}`}>
                    <header className="pay-card-top">
                      <span className={`pay-ico ${kind}`}>
                        <Icon name={iconName(kind)} />
                      </span>
                      <div className="pay-switch-wrap">
                        <span>{method.isActive ? "Activo" : "Inactivo"}</span>
                        <button
                          type="button"
                          className="pay-switch"
                          role="switch"
                          aria-checked={method.isActive}
                          disabled={method.demo}
                          onClick={() => void toggle(method)}
                          aria-label={`${method.isActive ? "Desactivar" : "Activar"} ${method.name}`}
                        >
                          <i />
                        </button>
                      </div>
                    </header>
                    <h3>
                      {method.name}
                      {method.demo ? <em>Ejemplo</em> : null}
                    </h3>
                    <p className="pay-kind">{typeLabel(kind)}</p>
                    <p className="pay-detail">{detailLine(method, kind)}</p>
                    <footer>
                      <button type="button" className="btn secondary" onClick={() => openForm(method)}>
                        Editar
                      </button>
                      {!method.demo ? (
                        <div className="catalog-more">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Más acciones de ${method.name}`}
                            onClick={() => setMenuId((id) => (id === method.id ? null : method.id))}
                          >
                            <Icon name="more" />
                          </button>
                          {menuId === method.id ? (
                            <div className="inbox-pop">
                              <button type="button" onClick={() => void remove(method)}>
                                Quitar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="pay-more-spacer" />
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="pay-preview" aria-label="Vista previa en WhatsApp">
          <div className="pay-phone">
            <header>
              <span className="pay-phone-dot" />
              <div>
                <strong>Asistente {company?.name ?? "Ayllu"}</strong>
                <small>en línea</small>
              </div>
            </header>
            <div className="pay-chat">
              <p className="pay-preview-kicker">Vista previa en WhatsApp</p>
              <div className="bubble">
                <p>¿Cómo puedo pagar?</p>
                <span className="bubble-meta">10:24</span>
              </div>
              <div className="bubble out">
                <p>{preview.text}</p>
                <span className="bubble-meta">
                  10:24
                  <Icon name="checks" />
                </span>
              </div>
              {preview.chips.length > 0 ? (
                <div className="pay-chips">
                  {preview.chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <footer>
              {preview.usingDemo
                ? "Vista con datos de ejemplo. El bot solo comparte métodos activos."
                : "El bot solo comparte métodos activos."}
            </footer>
          </div>
        </aside>
      </div>
    </div>
  );
}
