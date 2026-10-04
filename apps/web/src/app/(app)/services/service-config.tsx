"use client";

import { FormEvent, useState } from "react";
import { api, apiUpload, mediaUrl } from "@/lib/api";
import { formatMoney, WORKSPACE_CURRENCY } from "@/lib/money";
import { BrandMark, Icon } from "@/components/icons";

export type ServiceDraft = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes?: number | null;
  imageUrls?: string[];
  isActive: boolean;
  prices: Array<{ id: string; amount: string; currency: string; label: string; isDefault?: boolean }>;
};

const EXAMPLE: ServiceDraft = {
  id: "",
  name: "Paseo en kayak",
  description: "Disfruta de un paseo en kayak por el lago. Incluye kayak, remo y chaleco salvavidas.",
  durationMinutes: 30,
  isActive: true,
  prices: [{ id: "", amount: "40", currency: WORKSPACE_CURRENCY, label: "regular", isDefault: true }],
};

function priceOf(service: ServiceDraft) {
  return service.prices.find((p) => p.isDefault) ?? service.prices[0] ?? null;
}

export function ServiceConfig({
  service,
  companyName,
  onCancel,
  onSaved,
}: {
  service: ServiceDraft;
  companyName?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const initial = priceOf(service);
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [duration, setDuration] = useState(String(service.durationMinutes ?? 30));
  const [amount, setAmount] = useState(initial ? String(Number(initial.amount)) : "");
  const [currency] = useState(WORKSPACE_CURRENCY);
  const [isActive, setIsActive] = useState(service.isActive);
  const [imageUrls, setImageUrls] = useState<string[]>(service.imageUrls ?? []);
  const [imageDraft, setImageDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [examples, setExamples] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !service.id;

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

  function toggleExamples() {
    const next = !examples;
    setExamples(next);
    if (next) {
      setName(EXAMPLE.name);
      setDescription(EXAMPLE.description ?? "");
      setDuration(String(EXAMPLE.durationMinutes));
      setAmount("40");
      setIsActive(true);
      return;
    }
    setName(service.name);
    setDescription(service.description ?? "");
    setDuration(String(service.durationMinutes ?? 30));
    setAmount(initial ? String(Number(initial.amount)) : "");
    setIsActive(service.isActive);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const minutes = Number(duration);
    const price = Number(amount);
    if (!name.trim() || !description.trim()) {
      setError("Completa el nombre y la descripción.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Indica la duración en minutos.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Indica el precio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        durationMinutes: minutes,
        isActive,
        imageUrls,
      };
      const saved = service.id
        ? await api<ServiceDraft>(`/services/${service.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<ServiceDraft>("/services", { method: "POST", body: JSON.stringify(body) });
      const priceBody = {
        amount: price,
        currency,
        label: initial?.label || "regular",
        isDefault: true,
        serviceId: saved.id,
      };
      if (initial?.id) {
        await api(`/prices/${initial.id}`, { method: "PATCH", body: JSON.stringify(priceBody) });
      } else {
        await api("/prices", { method: "POST", body: JSON.stringify(priceBody) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  const minutes = Number(duration);
  const price = Number(amount);
  const previewName = name.trim() || "Nombre del servicio";
  const previewDesc = description.trim() || "Escribe qué incluye y qué debe saber el cliente.";
  const previewDuration = Number.isFinite(minutes) && minutes > 0 ? `${minutes} minutos` : "—";
  const previewPrice = formatMoney(Number.isFinite(price) ? price : 0, currency);

  return (
    <form className="svc-cfg" onSubmit={onSubmit}>
      <button type="button" className="pay-cfg-back" onClick={onCancel}>
        <Icon name="chevron-left" />
        Volver a servicios
      </button>

      <header className="pay-cfg-head">
        <div>
          <h1>{isNew ? "Agregar servicio" : "Editar servicio"}</h1>
          <p>
            {isNew
              ? "Completa la información para compartirla con tu asistente."
              : "Actualiza lo que el asistente cuenta sobre esta experiencia."}
          </p>
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
            <h2>1. Información del servicio</h2>
            <div className="pay-cfg-grid">
              <label className="pay-cfg-span">
                <span>Nombre del servicio *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Paseo en kayak" />
              </label>
              <label className="pay-cfg-span">
                <span>Descripción para el asistente *</span>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Disfruta de un paseo en kayak por el lago. Incluye kayak, remo y chaleco salvavidas."
                />
                <small className="reply-cfg-hint">Explica qué incluye y cualquier condición que el cliente deba conocer.</small>
              </label>
            </div>
          </section>

          <section className="pay-cfg-block">
            <h2>2. Fotos</h2>
            <p className="reply-cfg-hint">El asistente las envía por WhatsApp si piden fotos de este servicio o de las instalaciones.</p>
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

          <section className="pay-cfg-block">
            <h2>3. Duración y precio</h2>
            <div className="pay-cfg-grid">
              <label>
                <span>Duración *</span>
                <span className="svc-suffix">
                  <input
                    type="number"
                    min={1}
                    max={24 * 60}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required
                  />
                  <em>minutos</em>
                </span>
              </label>
              <label>
                <span>Precio *</span>
                <span className="svc-suffix">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <em>USD</em>
                </span>
                <small className="reply-cfg-hint">Los precios van en dólares.</small>
              </label>
            </div>
          </section>

          <section className="pay-cfg-block">
            <h2>4. Disponibilidad</h2>
            <div className="pay-cfg-active">
              <button
                type="button"
                className="pay-switch"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                aria-label={isActive ? "Desactivar servicio" : "Activar servicio"}
              >
                <i />
              </button>
              <div>
                <strong>Servicio activo</strong>
                <p>El asistente podrá ofrecerlo al guardar.</p>
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
              <Icon name="more" />
            </header>
            <div className="reply-phone-chat">
              <div className="bubble out">
                {imageUrls[0] ? <img className="bubble-photo" src={mediaUrl(imageUrls[0])} alt="" /> : null}
                <p>
                  <b>{previewName}</b>
                  <br />
                  Duración: {previewDuration}
                  <br />
                  Precio: {previewPrice}
                  <br />
                  <br />
                  {previewDesc}
                </p>
                <span className="bubble-meta">
                  12:34
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
            <span>La previa utiliza los datos del formulario.</span>
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
          {saving ? "Guardando…" : "Guardar servicio"}
        </button>
      </footer>
    </form>
  );
}
