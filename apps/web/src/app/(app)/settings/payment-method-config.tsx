"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { BrandMark, Icon } from "@/components/icons";

type MethodType = "TRANSFER" | "CARD";

export type PaymentDraft = {
  id: string;
  type: MethodType;
  name: string;
  isActive: boolean;
  bank?: string | null;
  accountType?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  holderId?: string | null;
  receiptEmail?: string | null;
  paymentUrl?: string | null;
  notes?: string | null;
};

const BANKS = [
  "Banco Pichincha",
  "Banco Guayaquil",
  "Banco del Pacífico",
  "Produbanco",
  "Banco Internacional",
  "Banco Bolivariano",
  "Banco del Austro",
];

const EXAMPLE: PaymentDraft = {
  id: "",
  type: "TRANSFER",
  name: "Banco Pichincha",
  isActive: true,
  bank: "Banco Pichincha",
  accountType: "Ahorros",
  accountNumber: "2200004821",
  accountHolder: "Empresa de ejemplo",
  holderId: "",
  receiptEmail: "pagos@example.com",
  paymentUrl: "",
  notes: "Realiza la transferencia y envía el comprobante por este chat.",
};

function maskAccount(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return value || "—";
  return `${"•".repeat(7)}${digits.slice(-4)}`;
}

function knownBank(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const hit = BANKS.find((bank) => {
    const short = bank.replace(/^Banco (del )?/i, "").toLowerCase();
    return bank.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(short) || short.includes(raw.toLowerCase());
  });
  return hit ?? "Otro";
}

function accountPhrase(type?: string | null) {
  if (!type) return "Cuenta";
  return type.toLowerCase().startsWith("cuenta") ? type : `Cuenta de ${type.toLowerCase()}`;
}

function bankLabel(value?: string | null) {
  const known = knownBank(value);
  if (known && known !== "Otro") return known;
  return value?.trim() || "Banco";
}

function previewLines(draft: PaymentDraft) {
  if (draft.type === "CARD") {
    return [
      "Link de pago",
      draft.name || "Pago con tarjeta",
      draft.paymentUrl || "https://…",
      draft.notes?.trim() || "Paga con este enlace y avísanos por este chat.",
    ];
  }
  return [
    "Transferencia bancaria",
    bankLabel(draft.bank) || draft.name || "Banco",
    `${accountPhrase(draft.accountType)}: ${maskAccount(draft.accountNumber)}`,
    `Titular: ${draft.accountHolder || "—"}`,
    draft.notes?.trim() || "Envía el comprobante por este chat.",
  ];
}

export function PaymentMethodConfig({
  method,
  onCancel,
  onSaved,
}: {
  method: PaymentDraft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<PaymentDraft>({
    ...method,
    bank: method.bank ?? "",
    accountType: method.accountType ?? "",
    accountNumber: method.accountNumber ?? "",
    accountHolder: method.accountHolder ?? "",
    holderId: method.holderId ?? "",
    receiptEmail: method.receiptEmail ?? "",
    paymentUrl: method.paymentUrl ?? "",
    notes: method.notes ?? "",
  });
  const [snapshot] = useState<PaymentDraft>({ ...method });
  const [examples, setExamples] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const bankChoice = knownBank(draft.bank);
  const lines = useMemo(() => previewLines(draft), [draft]);

  function set<K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleExamples() {
    const next = !examples;
    setExamples(next);
    setDraft(next ? { ...EXAMPLE, id: draft.id } : { ...snapshot, id: draft.id });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      type: draft.type,
      name: draft.name.trim(),
      isActive: draft.isActive,
      bank: draft.type === "TRANSFER" ? (bankLabel(draft.bank) !== "Banco" ? bankLabel(draft.bank) : draft.bank) || null : null,
      accountType: draft.type === "TRANSFER" ? draft.accountType || null : null,
      accountNumber: draft.type === "TRANSFER" ? draft.accountNumber || null : null,
      accountHolder: draft.type === "TRANSFER" ? draft.accountHolder || null : null,
      holderId: draft.type === "TRANSFER" ? draft.holderId || null : null,
      receiptEmail: draft.receiptEmail || null,
      paymentUrl: draft.type === "CARD" ? draft.paymentUrl || null : null,
      notes: draft.notes || null,
    };
    setSaving(true);
    setError("");
    try {
      if (draft.id) {
        await api(`/payments/${draft.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/payments", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="pay-cfg" onSubmit={onSubmit}>
      <button type="button" className="pay-cfg-back" onClick={onCancel}>
        <Icon name="chevron-left" />
        Volver a métodos de pago
      </button>

      <header className="pay-cfg-head">
        <div>
          <h1>Configuración del método de pago</h1>
          <p>Define los datos que el asistente compartirá con tus clientes.</p>
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

      <div className="pay-cfg-board">
        <div className="pay-cfg-main">
          <section className="pay-cfg-block">
            <h2>1. Información general</h2>
            <div className="pay-cfg-grid">
              <label>
                <span>Tipo de método *</span>
                <select
                  value={draft.type}
                  onChange={(e) => set("type", e.target.value as MethodType)}
                  required
                >
                  <option value="TRANSFER">Transferencia bancaria</option>
                  <option value="CARD">Link de pago</option>
                </select>
              </label>
              <label>
                <span>Nombre visible *</span>
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  placeholder={draft.type === "CARD" ? "Pago con tarjeta" : "Banco Pichincha"}
                />
              </label>
            </div>
          </section>

          {draft.type === "TRANSFER" ? (
            <section className="pay-cfg-block">
              <h2>2. Datos bancarios</h2>
              <div className="pay-cfg-grid">
                <label>
                  <span>Banco *</span>
                  <select
                    value={bankChoice}
                    onChange={(e) => set("bank", e.target.value === "Otro" ? "" : e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Elige el banco
                    </option>
                    {BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                    <option value="Otro">Otro</option>
                  </select>
                </label>
                <label>
                  <span>Tipo de cuenta *</span>
                  <select
                    value={draft.accountType || ""}
                    onChange={(e) => set("accountType", e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Elige el tipo
                    </option>
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                    {draft.accountType && !["Ahorros", "Corriente"].includes(draft.accountType) ? (
                      <option value={draft.accountType}>{draft.accountType}</option>
                    ) : null}
                  </select>
                </label>
                {bankChoice === "Otro" ? (
                  <label className="pay-cfg-span">
                    <span>Nombre del banco *</span>
                    <input
                      value={draft.bank ?? ""}
                      onChange={(e) => set("bank", e.target.value)}
                      required
                      placeholder="Nombre del banco"
                    />
                  </label>
                ) : null}
                <label>
                  <span>Número de cuenta *</span>
                  <input
                    value={draft.accountNumber ?? ""}
                    onChange={(e) => set("accountNumber", e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="2200004821"
                  />
                </label>
                <label>
                  <span>Titular de la cuenta *</span>
                  <input
                    value={draft.accountHolder ?? ""}
                    onChange={(e) => set("accountHolder", e.target.value)}
                    required
                    placeholder="Empresa de ejemplo"
                  />
                </label>
                <label>
                  <span>Identificación del titular</span>
                  <input
                    value={draft.holderId ?? ""}
                    onChange={(e) => set("holderId", e.target.value)}
                    placeholder="Cédula / RUC / CI"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Correo para comprobantes</span>
                  <input
                    type="email"
                    value={draft.receiptEmail ?? ""}
                    onChange={(e) => set("receiptEmail", e.target.value)}
                    placeholder="pagos@example.com"
                    autoComplete="off"
                  />
                </label>
              </div>
            </section>
          ) : (
            <section className="pay-cfg-block">
              <h2>2. Datos del enlace</h2>
              <div className="pay-cfg-grid">
                <label className="pay-cfg-span">
                  <span>Link de pago *</span>
                  <input
                    type="url"
                    value={draft.paymentUrl ?? ""}
                    onChange={(e) => set("paymentUrl", e.target.value)}
                    required
                    placeholder="https://"
                  />
                </label>
              </div>
            </section>
          )}

          <section className="pay-cfg-block">
            <h2>3. Instrucciones y disponibilidad</h2>
            <label>
              <span>Instrucciones para el cliente</span>
              <textarea
                rows={3}
                value={draft.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Realiza la transferencia y envía el comprobante por este chat."
              />
            </label>
            <div className="pay-cfg-active">
              <button
                type="button"
                className="pay-switch"
                role="switch"
                aria-checked={draft.isActive}
                onClick={() => set("isActive", !draft.isActive)}
                aria-label={draft.isActive ? "Desactivar método" : "Activar método"}
              >
                <i />
              </button>
              <div>
                <strong>Método activo</strong>
                <p>Disponible para compartir por WhatsApp</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="pay-cfg-preview" aria-label="Vista previa del mensaje">
          <h2>Vista previa del mensaje</h2>
          <div className="pay-cfg-bubble">
            <p className="pay-cfg-bubble-title">
              <BrandMark />
              {lines[0]}
            </p>
            {lines.slice(1).map((line) => (
              <p key={line}>{line}</p>
            ))}
            <span>12:34</span>
          </div>
          <p className="pay-cfg-hint">Los cambios se aplicarán en las nuevas respuestas del asistente.</p>
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
