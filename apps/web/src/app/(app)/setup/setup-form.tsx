"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api";
import { useAppPath } from "@/lib/app-path";
import { useMounted } from "@/lib/use-mounted";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";

type Step = { id: string; title: string; hint: string; index: number; done: boolean };
type Setup = {
  company: {
    id: string;
    name: string;
    timezone: string;
    botTone?: string | null;
    botSystemPrompt?: string | null;
    replyMode: "AUTO" | "HYBRID" | "MANUAL";
    setupCompleted: boolean;
  };
  steps: Step[];
  completedCount: number;
  total: number;
  next: string | null;
};

const ALERT_LABELS: Record<string, string> = {
  NEW_CONVERSATION: "Nueva conversación",
  HUMAN_TAKEOVER: "Cliente pide un asesor",
  BOT_FALLBACK: "El bot no supo responder",
  OUTSIDE_HOURS: "Mensaje fuera de horario",
  NEEDS_REPLY: "Hay que responder a mano",
  PAYMENT_PROOF: "Validar comprobante de reserva",
};

export default function SetupForm() {
  const { navigate } = useAppPath();
  const mounted = useMounted();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [step, setStep] = useState("empresa");
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await api<Setup>("/setup");
    setSetup(data);
    if (!data.steps.find((s) => s.id === step)) setStep(data.next ?? "empresa");
    return data;
  }

  useEffect(() => {
    if (!mounted) return;
    load().then((data) => {
      if (data.next) setStep(data.next);
    });
  }, [mounted]);

  if (!mounted || !setup) return <LoadingState label="Cargando configuración…" />;

  const current = setup.steps.find((s) => s.id === step) ?? setup.steps[0];

  return (
    <div>
      <PageHeader
        actions={<span className="badge">{setup.completedCount} de {setup.total} listos</span>}
      />
      <div className="steps">
        {setup.steps.map((s) => (
          <button
            key={s.id}
            className={`step ${s.id === step ? "active" : ""} ${s.done ? "done" : ""}`}
            onClick={() => setStep(s.id)}
          >
            {s.index + 1}. {s.title}
            {s.done ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="card">
        <h2>
          {current.index + 1}. {current.title}
        </h2>
        <p className="muted">{current.hint}</p>
        {msg && <p className="badge">{msg}</p>}
        {step === "empresa" && <EmpresaStep company={setup.company} onSaved={() => afterSave("canal")} />}
        {step === "canal" && <CanalStep onSaved={() => afterSave("catalogo")} />}
        {step === "catalogo" && <CatalogoStep onSaved={() => afterSave("conocimiento")} />}
        {step === "conocimiento" && <ConocimientoStep onSaved={() => afterSave("reglas")} />}
        {step === "reglas" && <ReglasStep onSaved={() => afterSave("alertas")} />}
        {step === "alertas" && <AlertasStep onSaved={() => afterSave("respuestas")} />}
        {step === "respuestas" && (
          <RespuestasStep
            replyMode={setup.company.replyMode}
            onSaved={async () => {
              const latest = await load();
              setMsg("Configuración de esta empresa lista.");
              if (latest.completedCount === latest.total) navigate("/dashboard");
            }}
          />
        )}
      </div>
    </div>
  );

  async function afterSave(nextId: string) {
    setMsg("Guardado.");
    await load();
    setStep(nextId);
  }
}

function EmpresaStep({
  company,
  onSaved,
}: {
  company: Setup["company"];
  onSaved: () => void;
}) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const session = getSession();
    await api(`/companies/${session?.companyId ?? company.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: form.get("name"),
        timezone: form.get("timezone"),
        botTone: form.get("botTone"),
        botSystemPrompt: form.get("botSystemPrompt"),
      }),
    });
    onSaved();
  }
  return (
    <form onSubmit={onSubmit}>
      <label>
        <span>Nombre de la empresa</span>
        <input name="name" required defaultValue={company.name} />
      </label>
      <label>
        <span>Zona horaria</span>
        <input name="timezone" required defaultValue={company.timezone} />
      </label>
      <label>
        <span>Tono del bot</span>
        <input name="botTone" defaultValue={company.botTone ?? "cercano"} />
      </label>
      <label>
        <span>Instrucciones del bot</span>
        <textarea name="botSystemPrompt" rows={3} defaultValue={company.botSystemPrompt ?? ""} />
      </label>
      <button className="btn">Guardar y seguir</button>
    </form>
  );
}

function CanalStep({ onSaved }: { onSaved: () => void }) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      provider: "META",
      phoneNumberId: form.get("phoneNumberId"),
      displayPhone: form.get("displayPhone") || null,
      isActive: true,
    };
    if (form.get("verifyToken")) body.verifyToken = form.get("verifyToken");
    if (form.get("accessToken")) body.accessToken = form.get("accessToken");
    await api("/settings/whatsapp", { method: "PUT", body: JSON.stringify(body) });
    onSaved();
  }
  return (
    <form onSubmit={onSubmit}>
      <p className="muted">Puedes usar un ID de prueba ahora y completar tokens reales después.</p>
      <label>
        <span>Phone Number ID</span>
        <input name="phoneNumberId" required placeholder="alpha-demo-phone" />
      </label>
      <label>
        <span>Teléfono visible</span>
        <input name="displayPhone" placeholder="+51 900 000 001" />
      </label>
      <label>
        <span>Verify token</span>
        <input name="verifyToken" type="password" />
      </label>
      <label>
        <span>Access token</span>
        <input name="accessToken" type="password" />
      </label>
      <button className="btn">Guardar canal y seguir</button>
    </form>
  );
}

function CatalogoStep({ onSaved }: { onSaved: () => void }) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const kind = String(form.get("kind"));
    const amount = Number(form.get("amount"));
    if (kind === "service") {
      const service = await api<{ id: string }>("/services", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || null,
          isActive: true,
        }),
      });
      if (amount > 0) {
        await api("/prices", {
          method: "POST",
          body: JSON.stringify({ serviceId: service.id, amount, currency: "USD", label: "regular", isDefault: true }),
        });
      }
    } else {
      const product = await api<{ id: string }>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || null,
          isActive: true,
        }),
      });
      if (amount > 0) {
        await api("/prices", {
          method: "POST",
          body: JSON.stringify({ productId: product.id, amount, currency: "USD", label: "regular", isDefault: true }),
        });
      }
    }
    onSaved();
  }
  return (
    <form onSubmit={onSubmit}>
      <label>
        <span>Tipo</span>
        <select name="kind">
          <option value="product">Producto</option>
          <option value="service">Servicio</option>
        </select>
      </label>
      <label>
        <span>Nombre</span>
        <input name="name" required />
      </label>
      <label>
        <span>Precio</span>
        <input name="amount" type="number" step="0.01" />
      </label>
      <label>
        <span>Descripción</span>
        <textarea name="description" rows={2} />
      </label>
      <button className="btn">Agregar al catálogo y seguir</button>
    </form>
  );
}

function ConocimientoStep({ onSaved }: { onSaved: () => void }) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api("/knowledge", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        content: form.get("content"),
        sourceType: "FAQ",
      }),
    });
    onSaved();
  }
  return (
    <form onSubmit={onSubmit}>
      <label>
        <span>Título</span>
        <input name="title" required defaultValue="Preguntas frecuentes" />
      </label>
      <label>
        <span>Contenido que el bot puede usar</span>
        <textarea name="content" rows={5} required placeholder="Horarios, precios, políticas…" />
      </label>
      <button className="btn">Indexar y seguir</button>
    </form>
  );
}

function ReglasStep({ onSaved }: { onSaved: () => void }) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api("/rules", {
      method: "POST",
      body: JSON.stringify({
        name: "Saludo inicial",
        type: "GREETING",
        priority: 10,
        enabled: true,
        conditions: { firstMessageOnly: true },
        actions: { reply: form.get("greeting") },
      }),
    });
    await api("/rules", {
      method: "POST",
      body: JSON.stringify({
        name: "Fuera de horario",
        type: "HOURS",
        priority: 5,
        enabled: true,
        conditions: {
          days: [1, 2, 3, 4, 5],
          startTime: form.get("startTime"),
          endTime: form.get("endTime"),
          outsideHours: true,
        },
        actions: { reply: form.get("hoursReply") },
      }),
    });
    onSaved();
  }
  return (
    <form onSubmit={onSubmit}>
      <label>
        <span>Saludo del primer mensaje</span>
        <textarea name="greeting" rows={2} required defaultValue="Hola, ¿en qué te ayudo?" />
      </label>
      <div className="row">
        <label>
          <span>Abre</span>
          <input name="startTime" defaultValue="09:00" />
        </label>
        <label>
          <span>Cierra</span>
          <input name="endTime" defaultValue="19:00" />
        </label>
      </div>
      <label>
        <span>Respuesta fuera de horario</span>
        <textarea name="hoursReply" rows={2} required defaultValue="Estamos fuera de horario. Te respondemos al siguiente día útil." />
      </label>
      <button className="btn">Crear reglas y seguir</button>
    </form>
  );
}

function AlertasStep({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<Array<{ type: string; enabled: boolean }>>([]);
  useEffect(() => {
    api<Array<{ type: string; enabled: boolean }>>("/alerts/settings").then(setSettings);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await api("/alerts/settings", {
      method: "PUT",
      body: JSON.stringify({ settings }),
    });
    onSaved();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="muted">Elige qué avisos verá el equipo de esta empresa.</p>
      {settings.map((s, i) => (
        <label key={s.type}>
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => {
              const next = [...settings];
              next[i] = { ...s, enabled: e.target.checked };
              setSettings(next);
            }}
          />{" "}
          {ALERT_LABELS[s.type] ?? s.type}
        </label>
      ))}
      <button className="btn">Guardar alertas y seguir</button>
    </form>
  );
}

function RespuestasStep({
  replyMode,
  onSaved,
}: {
  replyMode: "AUTO" | "HYBRID" | "MANUAL";
  onSaved: () => void;
}) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const session = getSession();
    await api(`/companies/${session?.companyId}`, {
      method: "PATCH",
      body: JSON.stringify({ replyMode: form.get("replyMode") }),
    });
    await api("/replies", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        body: form.get("body"),
        keywords: String(form.get("keywords") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    onSaved();
  }
  return (
    <form onSubmit={onSubmit}>
      <label>
        <span>Cómo responde el bot</span>
        <select name="replyMode" defaultValue={replyMode}>
          <option value="AUTO">Automático: el bot responde solo</option>
          <option value="HYBRID">Híbrido: el bot responde y avisa al equipo</option>
          <option value="MANUAL">Manual: un asesor responde (el bot solo saluda / horario)</option>
        </select>
      </label>
      <label>
        <span>Primera plantilla</span>
        <input name="title" required defaultValue="Precios" />
      </label>
      <label>
        <span>Texto que se envía</span>
        <textarea name="body" rows={3} required defaultValue="Te comparto nuestros precios vigentes. ¿Buscas un producto o un servicio?" />
      </label>
      <label>
        <span>Palabras clave (coma)</span>
        <input name="keywords" defaultValue="precio, cuesta, costo" />
      </label>
      <button className="btn">Terminar configuración</button>
    </form>
  );
}
