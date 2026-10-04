export type FlowChannel = { id: string; name: string; type: string };
export type FlowRule = { id: string; name: string };

export type FlowDraft = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  systemPrompt?: string | null;
  tone?: string | null;
  replyMode: string;
  channels?: FlowChannel[];
  rules?: FlowRule[];
  _count?: { channels: number; rules: number };
  demo?: boolean;
};

export const CREATE_PROMPT =
  "Ayuda al cliente a elegir una experiencia y pregunta para qué día quiere visitar Ayllu. Usa la información registrada y consulta la disponibilidad antes de confirmar una reserva.";

export const SCENARIOS = [
  { id: "reserve", label: "El cliente consulta cómo reservar" },
  { id: "entrance", label: "El cliente pregunta por la entrada" },
  { id: "place", label: "El cliente pregunta dónde queda" },
  { id: "human", label: "El cliente pide un asesor" },
  { id: "hello", label: "El cliente saluda por primera vez" },
] as const;

export function emptyFlow(): FlowDraft {
  return {
    id: "",
    name: "",
    description: "",
    isDefault: false,
    systemPrompt: CREATE_PROMPT,
    tone: "cálido",
    replyMode: "AUTO",
    channels: [],
    rules: [],
    _count: { channels: 0, rules: 0 },
  };
}

export function promptLines(text?: string | null) {
  return String(text ?? "")
    .split(/(?<=\.)\s+|\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export function simulateFlow(prompt: string, scenario: string) {
  const text = prompt.toLowerCase();
  if (scenario === "reserve") {
    if (/reserv|día|actividad/.test(text)) return "Preguntar qué actividad desea y para qué día.";
    return "Seguir la instrucción del flujo para orientar la reserva.";
  }
  if (scenario === "entrance") {
    if (/entrada|cotiz/.test(text)) return "Solo cotizar la entrada si el cliente pregunta por ella.";
    return "Usar los precios registrados, sin inventar.";
  }
  if (scenario === "place") {
    if (/mapa|dónde|donde/.test(text)) return "Enviar el mapa cuando pregunten dónde queda Ayllu.";
    return "Indicar cómo llegar con la información registrada.";
  }
  if (scenario === "human") {
    return "Si no sabe algo, derivar a una persona.";
  }
  if (/saluda|primera/.test(text)) return "Saludar solo la primera vez, en el idioma del cliente.";
  return "Aplicar las instrucciones del flujo.";
}

export const SAMPLES: FlowDraft[] = [
  {
    id: "demo-main",
    name: "Flujo principal",
    description: "Responde con el catálogo, el conocimiento y las reglas de la empresa.",
    isDefault: true,
    demo: true,
    replyMode: "AUTO",
    systemPrompt:
      "Atiende con calma y cercanía. Responde en el idioma del cliente. Para reservar, pregunta la actividad y la fecha.",
    channels: [
      { id: "d1", name: "WhatsApp", type: "WHATSAPP" },
      { id: "d2", name: "WhatsApp ventas", type: "WHATSAPP" },
      { id: "d3", name: "WhatsApp reservas", type: "WHATSAPP" },
    ],
    rules: [],
    _count: { channels: 3, rules: 0 },
  },
];
