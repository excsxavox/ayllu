"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMounted } from "@/lib/use-mounted";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";

type Wa = {
  provider: string;
  phoneNumberId: string;
  wabaId?: string | null;
  displayPhone?: string | null;
  isActive: boolean;
  hasAccessToken: boolean;
  hasVerifyToken: boolean;
};

type Ai = {
  hasLlmApiKey: boolean;
  llmBaseUrl?: string | null;
  chatModel?: string | null;
  embeddingModel?: string | null;
  botSystemPrompt?: string | null;
  botTone?: string | null;
  mapUrl?: string | null;
};

export default function SettingsForm() {
  const mounted = useMounted();
  const [wa, setWa] = useState<Wa | null>(null);
  const [ai, setAi] = useState<Ai | null>(null);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!mounted) return;
    Promise.all([
      api<Wa | null>("/settings/whatsapp").then(setWa).catch(() => setWa(null)),
      api<Ai>("/settings/ai").then(setAi).catch(() => setAi(null)),
    ]).finally(() => setReady(true));
  }, [mounted]);

  if (!mounted || !ready) return <LoadingState label="Cargando ajustes…" />;

  async function saveWa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      provider: form.get("provider") || "META",
      phoneNumberId: form.get("phoneNumberId"),
      wabaId: form.get("wabaId") || null,
      displayPhone: form.get("displayPhone") || null,
      isActive: true,
    };
    if (form.get("accessToken")) body.accessToken = form.get("accessToken");
    if (form.get("verifyToken")) body.verifyToken = form.get("verifyToken");
    if (form.get("appSecret")) body.appSecret = form.get("appSecret");
    setWa(await api("/settings/whatsapp", { method: "PUT", body: JSON.stringify(body) }));
    setMsg("Cuenta WhatsApp guardada. Los secretos quedan cifrados.");
  }

  async function savePlace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setAi(
      await api("/settings/ai", {
        method: "PUT",
        body: JSON.stringify({ mapUrl: String(form.get("mapUrl") ?? "").trim() || null }),
      }),
    );
    setMsg("Link del mapa guardado. El bot lo envía si preguntan dónde queda.");
  }

  async function saveAi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      llmBaseUrl: form.get("llmBaseUrl") || null,
      chatModel: form.get("chatModel") || null,
      embeddingModel: form.get("embeddingModel") || null,
      botSystemPrompt: form.get("botSystemPrompt") || null,
      botTone: form.get("botTone") || null,
    };
    if (form.get("llmApiKey")) body.llmApiKey = form.get("llmApiKey");
    setAi(await api("/settings/ai", { method: "PUT", body: JSON.stringify(body) }));
    setMsg("Ajustes de IA guardados.");
  }

  return (
    <div className="stack">
      <PageHeader />
      {msg && <p className="badge toast">{msg}</p>}
      <form className="card" onSubmit={saveWa}>
        <h2>WhatsApp</h2>
        <p className="page-lead">
          Credenciales del canal WhatsApp. Abajo configuras las cuentas y links que el bot puede enviar.
          Webhook: POST http://localhost:3001/webhooks/whatsapp
        </p>
        <label>
          <span>Proveedor</span>
          <select name="provider" defaultValue={wa?.provider ?? "META"}>
            <option value="META">Meta Cloud API</option>
            <option value="EVOLUTION">Evolution (futuro)</option>
            <option value="TWILIO">Twilio (futuro)</option>
          </select>
        </label>
        <label>
          <span>Phone Number ID</span>
          <input name="phoneNumberId" required defaultValue={wa?.phoneNumberId} />
        </label>
        <label>
          <span>WABA ID</span>
          <input name="wabaId" defaultValue={wa?.wabaId ?? ""} />
        </label>
        <label>
          <span>Teléfono visible</span>
          <input name="displayPhone" defaultValue={wa?.displayPhone ?? ""} />
        </label>
        <label>
          <span>Access token {wa?.hasAccessToken ? "(ya guardado)" : ""}</span>
          <input name="accessToken" type="password" />
        </label>
        <label>
          <span>Verify token {wa?.hasVerifyToken ? "(ya guardado)" : ""}</span>
          <input name="verifyToken" type="password" />
        </label>
        <label>
          <span>App secret</span>
          <input name="appSecret" type="password" />
        </label>
        <button className="btn">Guardar canal</button>
      </form>
      <form className="card" onSubmit={savePlace}>
        <h2>Lugar</h2>
        <p className="page-lead">Link del mapa que el bot puede enviar cuando preguntan dónde queda o cómo llegar.</p>
        <label>
          <span>Link del mapa</span>
          <input
            name="mapUrl"
            type="url"
            inputMode="url"
            placeholder="https://maps.google.com/…"
            defaultValue={ai?.mapUrl ?? ""}
          />
        </label>
        <button className="btn">Guardar mapa</button>
      </form>
      <form className="card" onSubmit={saveAi}>
        <h2>Modelo y tono</h2>
        <p className="page-lead">Define cómo habla el bot de esta empresa.</p>
        <label>
          <span>Tono</span>
          <input name="botTone" defaultValue={ai?.botTone ?? "cercano"} />
        </label>
        <label>
          <span>Prompt de sistema</span>
          <textarea name="botSystemPrompt" rows={4} defaultValue={ai?.botSystemPrompt ?? ""} />
        </label>
        <label>
          <span>API key OpenAI-compatible {ai?.hasLlmApiKey ? "(ya guardada)" : ""}</span>
          <input name="llmApiKey" type="password" />
        </label>
        <label>
          <span>Base URL</span>
          <input name="llmBaseUrl" defaultValue={ai?.llmBaseUrl ?? ""} placeholder="https://api.openai.com/v1" />
        </label>
        <div className="row">
          <label>
            <span>Modelo chat</span>
            <input name="chatModel" defaultValue={ai?.chatModel ?? "gpt-4o-mini"} />
          </label>
          <label>
            <span>Modelo embeddings</span>
            <input name="embeddingModel" defaultValue={ai?.embeddingModel ?? "text-embedding-3-small"} />
          </label>
        </div>
        <button className="btn">Guardar IA</button>
      </form>
    </div>
  );
}
