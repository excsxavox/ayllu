export type RuleType = "HOURS" | "GREETING" | "HANDOVER" | "KEYWORD" | "PROMOTION" | "FALLBACK" | "TAG_CONTACT";
export type Priority = "alta" | "media" | "baja";
export type WhenId = "reserve" | "addon" | "prices" | "unresolved" | "greeting" | "hours" | "handover" | "group" | "keyword";
export type FallbackId = "human" | "none";

export const FALLBACK_OPTIONS: Array<{ id: FallbackId; label: string }> = [
  { id: "human", label: "Derivar a una persona" },
  { id: "none", label: "No hacer nada más" },
];

export const REQUEST_OPTIONS: Array<{ id: WhenId; label: string }> = [
  { id: "reserve", label: "Nueva reserva" },
  { id: "addon", label: "Complemento o implemento" },
  { id: "prices", label: "Consulta de precios" },
  { id: "group", label: "Grupo de 12 o más" },
  { id: "unresolved", label: "Consulta sin resolver" },
  { id: "greeting", label: "Saludo inicial" },
  { id: "hours", label: "Fuera de horario" },
  { id: "handover", label: "Pide un asesor" },
];

export type RuleDraft = {
  id: string;
  name: string;
  type: RuleType;
  priority: number;
  enabled: boolean;
  flowId?: string | null;
  flow?: { id: string; name: string } | null;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  demo?: boolean;
};

export const WHEN_OPTIONS: Array<{ id: WhenId; label: string; type: RuleType; keywords?: string[]; icon: string }> = [
  { id: "reserve", label: "El cliente quiere reservar", type: "KEYWORD", keywords: ["reserv", "agendar", "cita"], icon: "calendar" },
  { id: "addon", label: "El cliente solicita un complemento", type: "KEYWORD", keywords: ["tienda", "complemento", "implemento"], icon: "box" },
  { id: "prices", label: "El cliente consulta precios o condiciones", type: "KEYWORD", keywords: ["precio", "cuesta"], icon: "file" },
  { id: "group", label: "El grupo es de 12 o más personas", type: "HANDOVER", icon: "user" },
  { id: "unresolved", label: "La consulta no puede resolverse", type: "FALLBACK", icon: "user" },
  { id: "greeting", label: "Es el primer mensaje o un saludo", type: "GREETING", icon: "chat" },
  { id: "hours", label: "Estamos fuera de horario", type: "HOURS", icon: "clock" },
  { id: "handover", label: "Pide un asesor", type: "HANDOVER", icon: "user" },
  { id: "keyword", label: "Coincide una palabra clave", type: "KEYWORD", icon: "tag" },
];

export const PRIORITIES: Array<{ id: Priority; label: string; value: number }> = [
  { id: "alta", label: "Alta", value: 10 },
  { id: "media", label: "Media", value: 50 },
  { id: "baja", label: "Baja", value: 100 },
];

const WHEN_IDS = new Set(WHEN_OPTIONS.map((item) => item.id));

export function emptyRule(): RuleDraft {
  return {
    id: "",
    name: "",
    type: "KEYWORD",
    priority: 10,
    enabled: true,
    flowId: null,
    conditions: { when: "reserve", keywords: ["reserv", "agendar", "cita"] },
    actions: {
      reply: "Consulta la disponibilidad de la fecha y el servicio solicitados antes de confirmar. Si faltan datos, solicítalos primero.",
      requireVerified: true,
      fallback: "human",
      transferToHuman: false,
    },
  };
}

export function whenOf(rule: RuleDraft): WhenId {
  const stored = rule.conditions?.when;
  if (typeof stored === "string" && WHEN_IDS.has(stored as WhenId)) return stored as WhenId;
  if (rule.type === "GREETING") return "greeting";
  if (rule.type === "HOURS") return "hours";
  if (rule.type === "FALLBACK") return "unresolved";
  if (rule.type === "HANDOVER") {
    const min = Number(rule.conditions?.minGuests);
    if (Number.isFinite(min) && min > 0) return "group";
    return "handover";
  }
  const keys = ((rule.conditions?.keywords as string[]) ?? []).map((k) => k.toLowerCase());
  const joined = keys.join(" | ");
  if (keys.some((k) => k === "precio" || k === "cuesta" || k.includes("entrada") || k.includes("ingreso"))) return "prices";
  if (keys.some((k) => /tienda|complemento|implemento|carpa|tent|acampar|camping/.test(k))) return "addon";
  if (keys.some((k) => /reserv|agendar|cita/.test(k)) && keys.length <= 4) return "reserve";
  if (joined) return "keyword";
  return "keyword";
}

export function priorityOf(value: number): Priority {
  if (value <= 20) return "alta";
  if (value <= 60) return "media";
  return "baja";
}

export function priorityValue(id: Priority) {
  return PRIORITIES.find((p) => p.id === id)?.value ?? 100;
}

export function iconOf(rule: RuleDraft) {
  return WHEN_OPTIONS.find((w) => w.id === whenOf(rule))?.icon ?? "sliders";
}

export function whenLabel(rule: RuleDraft) {
  const when = whenOf(rule);
  if (when === "group") {
    const min = Number(rule.conditions?.minGuests) || 12;
    return `El grupo es de ${min} o más personas`;
  }
  return WHEN_OPTIONS.find((w) => w.id === when)?.label ?? "Cuando se cumple la condición";
}

export function actionLabel(rule: RuleDraft) {
  const reply = String(rule.actions?.reply ?? "").trim();
  if (reply) return reply;
  if (rule.actions?.transferToHuman || whenOf(rule) === "group" || whenOf(rule) === "handover") {
    return "Transferir la atención a una persona.";
  }
  return "Seguir el flujo del asistente.";
}

export function warningOf(rule: RuleDraft) {
  if (rule.actions?.requireVerified) return "No confirmar sin verificar";
  if (rule.actions?.transferToHuman || whenOf(rule) === "group") return "Requiere atención humana";
  return "";
}

export function instructionPlaceholder(when: WhenId) {
  if (when === "group") return "Pasar el caso a una persona. No confirmar ni cotizar el grupo de forma automática.";
  if (when === "handover") return "Avisar que lo pasas con alguien del equipo.";
  if (when === "hours") return "Avisa el horario y cuándo vuelves a atender.";
  if (when === "greeting") return "Saluda y pregunta en qué le ayudas, sin listar precios.";
  if (when === "addon") return "Ofrecerlo junto al servicio principal y solo si hay stock.";
  if (when === "prices") return "Usar los datos vigentes y no improvisar si faltan.";
  return "Consulta la disponibilidad de la fecha y el servicio solicitados antes de confirmar.";
}

export function toPayload(draft: RuleDraft) {
  const when = WHEN_OPTIONS.find((w) => w.id === whenOf(draft)) ?? WHEN_OPTIONS[0];
  const typedKeywords = ((draft.conditions.keywords as string[]) ?? []).map((k) => k.trim()).filter(Boolean);
  const keywords = typedKeywords.length ? typedKeywords : when.keywords ?? [];
  const minGuests = Number(draft.conditions.minGuests);
  const conditions: Record<string, unknown> = { when: when.id };

  if (when.id === "greeting") conditions.firstMessageOnly = true;
  if (when.id === "hours") {
    conditions.outsideHours = true;
    conditions.days = Array.isArray(draft.conditions.days) ? draft.conditions.days : [1, 2, 3, 4, 5];
    conditions.startTime = String(draft.conditions.startTime || "09:00");
    conditions.endTime = String(draft.conditions.endTime || "19:00");
  }
  if (when.id === "group") {
    conditions.minGuests = Number.isFinite(minGuests) && minGuests > 0 ? minGuests : 12;
  }
  if (when.id === "handover" || when.id === "keyword" || when.id === "reserve" || when.id === "addon" || when.id === "prices") {
    conditions.keywords = keywords;
  }
  if (when.id === "handover" && !conditions.keywords) {
    conditions.keywords = ["asesor", "humano", "alguien"];
  }

  return {
    name: draft.name.trim(),
    type: when.type,
    priority: draft.priority,
    enabled: draft.enabled,
    flowId: draft.flowId || null,
    conditions,
    actions: {
      reply: String(draft.actions.reply ?? "").trim() || undefined,
      replyEn: draft.actions.replyEn || undefined,
      transferToHuman: Boolean(draft.actions.transferToHuman) || draft.actions.fallback === "human" || when.id === "group" || when.id === "handover",
      requireVerified: Boolean(draft.actions.requireVerified),
      fallback: draft.actions.fallback ?? (when.id === "group" || when.id === "handover" ? "human" : "none"),
    },
  };
}

export const SAMPLES: RuleDraft[] = [
  {
    id: "demo-1",
    name: "Verificar disponibilidad",
    type: "KEYWORD",
    priority: 10,
    enabled: true,
    flow: { id: "reservas", name: "Reservas" },
    flowId: "reservas",
    demo: true,
    conditions: { when: "reserve", keywords: ["reserv"] },
    actions: {
      reply: "Consultar la agenda antes de confirmar.",
      requireVerified: true,
      fallback: "human",
    },
  },
  {
    id: "demo-2",
    name: "Complementos vinculados",
    type: "KEYWORD",
    priority: 10,
    enabled: true,
    flow: { id: "servicios", name: "Servicios" },
    flowId: "servicios",
    demo: true,
    conditions: { when: "addon", keywords: ["tienda"] },
    actions: {
      reply: "Ofrecerlo junto al servicio principal y solo si hay stock.",
    },
  },
  {
    id: "demo-3",
    name: "Usar información registrada",
    type: "KEYWORD",
    priority: 10,
    enabled: true,
    demo: true,
    conditions: { when: "prices", keywords: ["precio"] },
    actions: {
      reply: "Usar los datos vigentes y no improvisar si faltan.",
    },
  },
  {
    id: "demo-4",
    name: "Derivar casos sin resolver",
    type: "FALLBACK",
    priority: 50,
    enabled: true,
    demo: true,
    conditions: { when: "unresolved" },
    actions: {
      reply: "Transferir la atención a una persona.",
      transferToHuman: true,
      fallback: "human",
    },
  },
];
