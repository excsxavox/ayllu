const WEEKDAY_NAMES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const APP_HINT =
  /\b(precio|cuesta|cu[aá]nto|vale|horario|reserv\w*|cita|agend\w*|turno|cupo|disponib\w*|producto|servicio|men[uú]|carta|tienen|hay|promoci[oó]n|cat[aá]logo|stock|sku|informaci[oó]n|info|foto|fotos|imagen|glamping|pesca|botes|acampar|camping|carpa|acampada|entrada|ingreso|ni[nñ]os?|mayores|adulto|pag\w*|transferenc|cuenta|tarjeta|deposito|dep[oó]sito|price|cost|how much|book|booking|reservation|available|product|service|menu|catalog|photo|picture|entrance|kids?|children|adults?|pay|card|deposit|fishing|boats?|tent|trail|table)\b/i;

export type ReplyLocale = "es" | "en";

export function isGreetingOnly(text: string): boolean {
  const t = fold(text);
  return /^(hola+|buenas?|buenos dias|buenas tardes|buenas noches|hey+|hi+|hello|howdy|good morning|good afternoon|good evening|saludos|que tal|buen dia)[\s!.]*$/.test(
    t,
  );
}

export function detectReplyLocale(text: string): ReplyLocale {
  const t = fold(text);
  const enGreeting = /^(hi+|hello|hey+|howdy|good morning|good afternoon|good evening)\b/.test(t);
  const esGreeting = /^(hola+|buenas?|buenos dias|buenas tardes|buenas noches|saludos|que tal|buen dia)\b/.test(t);
  if (enGreeting && !esGreeting) return "en";
  if (esGreeting && !enGreeting) return "es";
  const enHits = (
    t.match(
      /\b(the|what|how|much|price|cost|book|booking|reservation|available|entrance|kids?|children|adults?|lake|tent|trail|boat|fishing|table|please|would|like|want|need|pay|card|hello|hi|can we|do you)\b/g,
    ) ?? []
  ).length;
  const esHits = (
    t.match(
      /\b(hola|que|cuanto|reserv|entrada|ninos?|mesa|lago|precio|cuesta|puedo|quiero|necesito|gracias|buenas|acampar)\b/g,
    ) ?? []
  ).length;
  if (enHits > esHits && enHits >= 1) return "en";
  return "es";
}

export function localizedReply(
  actions: { reply?: string; replyEn?: string } | null | undefined,
  locale: ReplyLocale,
): string | undefined {
  if (!actions) return undefined;
  if (locale === "en") return actions.replyEn || undefined;
  return actions.reply || undefined;
}

/** True when the customer is asking something the catalog/knowledge should answer. */
export function messageNeedsAppContext(text: string): boolean {
  const t = text.trim();
  if (!t || isGreetingOnly(t) || isDiscoverNeed(t)) return false;
  if (isReservationFollowUp(t) || looksLikeBooking(t) || isAckOnly(t) || asksForPhotos(t)) return true;
  if (asksForLocation(t) || asksForHours(t)) return true;
  if (t.length >= 24) return true;
  if (/[¿?]/.test(t)) return true;
  if (APP_HINT.test(t)) return true;
  return t.split(/\s+/).filter(Boolean).length >= 3;
}

export function looksLikeBooking(text: string): boolean {
  return /reserv|cita|agend|turno|cupo|disponib|mesa|restaurante|cumple|birthday|full\s*day|dia completo|\bbook(ing)?\b|\breservation\b|\bavailable\b/i.test(
    text,
  );
}

export function isAckOnly(text: string): boolean {
  return /^(ok+|okay|vale|listo|perfecto|dale|de una|si|yes|thanks|thank you|gracias)[\s!.]*$/.test(fold(text));
}

export function isReservationFollowUp(text: string): boolean {
  const t = fold(text);
  return /\b(quede reservad\w*|quedo reservad\w*|esta reservad\w*|hay reserva|me (avisa|avisas|confirmas)|avisame|avisa por favor|let me know|was (i|it) (booked|reserved)|did you (book|reserve)|confirm(ed)? the (booking|reservation))\b/.test(
    t,
  );
}

export function keepConversationGoing(locale: ReplyLocale, userText: string): string {
  if (isReservationFollowUp(userText)) {
    return locale === "en"
      ? "I have your request 🌿 A person from the team confirms the reservation. I'll write you as soon as it's set."
      : "Tengo tu pedido 🌿 Una persona del equipo confirma la reserva. Te escribo apenas quede lista.";
  }
  if (looksLikeBooking(userText) || wantsStayReservation(userText) || /como\s+(nos\s+)?(pueden|podrian|podriamos)\s+reserv/i.test(fold(userText))) {
    return locale === "en"
      ? "To hold it we ask for a 50% deposit. Tell me the day and I’ll send the transfer details."
      : "Para asegurarla pedimos un abono del 50%. Dime el día y te paso los datos de transferencia.";
  }
  if (isAckOnly(userText)) {
    return locale === "en"
      ? "Perfect 🌿 What would you like to do, and for which day?"
      : "Perfecto 🌿 ¿Qué te gustaría hacer y para qué día?";
  }
  return locale === "en"
    ? "I'm here 🌿 Tell me what you need and I'll help you."
    : "Aquí estoy 🌿 Dime qué necesitas y te ayudo.";
}

export function asksForPhotos(text: string): boolean {
  const t = fold(text);
  return /\b(fotos?|imagen(es)?|fotos de|photo|photos|pictures?|instalaciones)\b/i.test(t);
}

export function asksForLocation(text: string): boolean {
  const t = fold(text);
  return /\b(donde|ubicacion|como llegar|mapa|direccion|where|location|address|how to get)\b/i.test(t);
}

export function asksForHours(text: string): boolean {
  const t = fold(text);
  return /\b(horario|abren|cierran|a que hora|que hora|hours?|open(ing)?|clos(e|ing))\b/i.test(t);
}

export function asksWhatTheyOffer(text: string): boolean {
  const t = fold(text);
  return /\b(que ofrecen|que tienen|que se puede (hacer|reservar)|lo que ofrecen|what do you (offer|have)|what can (i|we) (do|book))\b/i.test(
    t,
  );
}

export function isDiscoverNeed(text: string): boolean {
  const t = fold(text);
  if (!t) return true;
  if (isGreetingOnly(text)) return true;
  if (asksForLocation(text) || asksForHours(text) || isPriceQuestion(text) || asksWhatTheyOffer(text) || asksForPhotos(text)) {
    return false;
  }
  if (looksLikeBooking(text) || isReservationFollowUp(text) || isAckOnly(text) || mentionsPartySize(text)) {
    return false;
  }
  if (/\b(glamping|pesca|bote|sender|acampar|camping|carpa|entrada|precio|pag\w*|asesor|humano)\b/.test(t)) return false;
  if (/\b(ayuda|ayudame|ayudas|favor|x favor|please|help)\b/.test(t) && t.split(/\s+/).length <= 8) return true;
  if (
    (/\balgo\b.{0,20}\b(especial|diferente)\b/.test(t) || /\b(informacion|info)\b/.test(t)) &&
    !/\b(promocion|descuento|oferta)\b/.test(t)
  ) {
    return t.split(/\s+/).length <= 10;
  }
  return false;
}

export function formatLocationReply(locale: ReplyLocale, placeName: string, mapUrl?: string | null): string {
  const title = locale === "en" ? "📍 *Location*" : "📍 *Ubicación*";
  const line = mapUrl
    ? mapUrl
    : locale === "en"
      ? `${placeName}, by the lake.`
      : `${placeName}, junto al lago.`;
  return `${title}\n${placeName}\n${line}`;
}

export function wantsStayReservation(text: string): boolean {
  const t = fold(text);
  const stay = /\b(glamping|glamp|domo|acampar|camping|carpa|caba[nñ]a|noche)\b/.test(t);
  const want = /\b(quiero|necesito|reserv|agend|para el|para la)\b/.test(t);
  return stay && (want || Boolean(parseBookingDateHint(text, "America/Lima")));
}

export function asksForReservationDetails(text: string): boolean {
  const t = fold(text);
  if (/\b(numero de cuenta|cuenta banc|datos de (la )?transferenc|datos (del|de) (abono|pago))\b/.test(t)) {
    return true;
  }
  if (/\bdatos\b/.test(t) && /\b(reserv\w*|abono|transferenc|pago|cuenta)\b/.test(t)) return true;
  if (/\bpara (poder )?(hacer )?(la )?reserv/.test(t)) return true;
  return false;
}

export type CrmLiveStage = "TALKING" | "INTERESTED" | "RESERVED";

const CRM_RANK: Record<string, number> = {
  NEW: 0,
  TALKING: 1,
  INTERESTED: 2,
  RESERVED: 3,
  WON: 4,
  LOST: -1,
};

export function crmStageRank(stage: string) {
  return CRM_RANK[stage] ?? 0;
}

/** How far the chat itself should push the CRM card. */
export function inferCrmFromMessage(text: string, timezone = "America/Lima"): { stage: CrmLiveStage; nextAction: string } | null {
  const raw = text.trim();
  if (!raw || isGreetingOnly(raw) || isDiscoverNeed(raw) || isAckOnly(raw)) return null;
  if (shouldOfferDeposit(raw, timezone) || asksForReservationDetails(raw)) {
    return { stage: "RESERVED", nextAction: "Confirmar abono" };
  }
  const plan = classifyIntent(raw);
  if (plan.intent === "booking" || wantsStayReservation(raw) || looksLikeBooking(raw)) {
    return { stage: "INTERESTED", nextAction: "Cerrar fecha y abono" };
  }
  if (plan.intent === "payment") {
    return { stage: "INTERESTED", nextAction: "Enviar datos de pago" };
  }
  if (
    plan.intent === "product" ||
    plan.intent === "service" ||
    plan.intent === "promo" ||
    plan.needsCatalog ||
    asksForPhotos(raw) ||
    isPriceQuestion(raw)
  ) {
    return { stage: "INTERESTED", nextAction: "Responder con lo que pidió" };
  }
  return { stage: "TALKING", nextAction: "Seguir la conversación" };
}

export function shouldOfferDeposit(text: string, timezone = "America/Lima"): boolean {
  if (asksForPhotos(text) && !looksLikeBooking(text) && !wantsStayReservation(text) && !asksForReservationDetails(text)) {
    return false;
  }
  if (asksForReservationDetails(text)) return true;
  const hasDate = Boolean(parseBookingDateHint(text, timezone));
  return (
    (looksLikeBooking(text) || wantsStayReservation(text)) &&
    (hasDate || /\b(pag\w*|transferenc|abono|adelanto|deposito|dep[oó]sito|cuenta banc|pay|deposit)\b/i.test(fold(text)))
  );
}

export function stayLabel(text: string, locale: ReplyLocale): string {
  const t = fold(text);
  if (/glamp|domo/.test(t)) return locale === "en" ? "the glamping" : "el glamping";
  if (/acamp|camping|carpa/.test(t)) return locale === "en" ? "camping" : "acampar";
  if (/caba[nñ]a/.test(t)) return locale === "en" ? "the cabin" : "la cabaña";
  if (/noche/.test(t)) return locale === "en" ? "the night" : "la noche";
  return locale === "en" ? "the reservation" : "la reserva";
}

type TransferBits = {
  type: string;
  bank?: string | null;
  accountType?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
};

export function formatTransferDetails(methods: TransferBits[]): string {
  const transfer = methods.find((m) => m.type === "TRANSFER" && (m.bank || m.accountNumber));
  if (!transfer) return "";
  return [
    "Datos para la transferencia:",
    transfer.bank ? `🏦 Banco: ${transfer.bank}` : "",
    transfer.accountType ? `— Tipo de cuenta: ${transfer.accountType}` : "",
    transfer.accountNumber ? `— Nº de cuenta: ${transfer.accountNumber}` : "",
    transfer.accountHolder ? `— Titular: ${transfer.accountHolder}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDepositHoldReply(
  locale: ReplyLocale,
  text: string,
  depositPercent: number,
  methods: TransferBits[],
): string {
  const what = stayLabel(text, locale);
  const intro =
    locale === "en"
      ? `Once we confirm availability, you can hold ${what} with a ${depositPercent}% deposit by bank transfer.`
      : `Una vez confirmada la disponibilidad, puedes asegurar ${what} con un abono del ${depositPercent}%, mediante transferencia bancaria.`;
  const details = formatTransferDetails(methods);
  return details ? `${intro}\n\n${details}` : intro;
}

export function formatHoursReply(locale: ReplyLocale, hours: string[]): string {
  const title = locale === "en" ? "🕐 *Hours*" : "🕐 *Horario*";
  const allOpen =
    hours.length > 0 && hours.every((h) => /00:00\s*-\s*23:59|24\s*horas|24\s*hours/i.test(h) && !/cerrado/i.test(h));
  const body = allOpen
    ? locale === "en"
      ? "Every day, 24 hours."
      : "Todos los días, las 24 horas."
    : hours.length
      ? hours.join("\n")
      : locale === "en"
        ? "Write us and we confirm the hours."
        : "Escríbenos y te confirmamos el horario.";
  return `${title}\n${body}`;
}

export function isPriceQuestion(text: string): boolean {
  return /\b(precio|cuesta|cu[aá]nto|valen?|cobran?|how much|cost|price|entrada|ingreso|entrance|ticket)\b/i.test(
    text,
  );
}

export function mentionsPartySize(text: string): boolean {
  return /\b\d+\s*(personas?|adultos?|ninos?|guests?|people|kids?)\b/i.test(fold(text));
}

export function askedForGuestCount(text: string): boolean {
  return /cu[aá]ntas?\s+personas|para cu[aá]nt|how many (people|guests|persons)|how many are coming/i.test(
    text,
  );
}

export type BotIntent = "greeting" | "product" | "service" | "booking" | "faq" | "promo" | "handover" | "payment" | "general";
export type KnowledgeSourceFilter = "FAQ" | "MANUAL" | "CATALOG";

export type IntentPlan = {
  intent: BotIntent;
  sources: KnowledgeSourceFilter[];
  needsCatalog: boolean;
  needsBooking: boolean;
  needsPromo: boolean;
  needsPayment: boolean;
  needsMap: boolean;
  needsHours: boolean;
  chunkLimit: number;
};

const PRODUCT_HINT =
  /\b(precio|cuesta|cu[aá]nto|vale|producto|sku|stock|serum|crema|aceite|souvenir|tienda|comprar|cat[aá]logo|entrada|ingreso|price|cost|how much|product|buy|catalog|entrance|ticket)\b/i;
const SERVICE_HINT =
  /\b(servicio|tratamiento|masaje|glamping|pesca|bote|sender|tour|experiencia|actividad|acampar|camping|carpa|acampada|mesa|restaurante|cumple|birthday|fishing|boat|trail|hike)\b/i;

export function mentionsCatalogAddon(text: string): boolean {
  return /\b(acampar|camping|carpa|tiendas?\s+de\s+campa[nñ]a|implementos?|acampada|tent)\b/i.test(text);
}
const FAQ_HINT =
  /\b(c[oó]mo|d[oó]nde|qu[eé] es|pol[ií]tica|cancel|llegar|ubicaci[oó]n|estacion|wifi|mascota|ni[nñ]o|edad|incluye|requisito|where|what is|policy|cancel|location|parking|pet|child|age|include|requirement)\b/i;
const PROMO_HINT = /\b(promoci[oó]n|descuento|oferta|2x1|combo|promo|discount|offer|deal)\b/i;
const HANDOVER_HINT =
  /\b(asesor|humano|persona|agente|hablar con alguien|llamar|queja|reclamo|human|agent|person|speak to someone|talk to (a )?person|complaint)\b/i;
const PAYMENT_HINT =
  /\b(pag\w*|transferenc|n[uú]mero de cuenta|cuenta banc|deposito|dep[oó]sito|tarjeta|link de pago|enlace de pago|payphone|deuna|pay|payment|bank account|card|deposit)\b/i;

/** Clasifica el mensaje para cargar solo el contexto que hace falta (menos tokens). */
function plan(
  intent: BotIntent,
  extra: Partial<IntentPlan> & Pick<IntentPlan, "sources" | "chunkLimit">,
): IntentPlan {
  return {
    intent,
    needsCatalog: false,
    needsBooking: false,
    needsPromo: false,
    needsPayment: false,
    needsMap: false,
    needsHours: false,
    ...extra,
  };
}

export function classifyIntent(text: string): IntentPlan {
  const t = fold(text);
  if (!t || isGreetingOnly(text)) {
    return plan("greeting", { sources: [], needsCatalog: false, chunkLimit: 0 });
  }
  if (isReservationFollowUp(text) || isAckOnly(text)) {
    return plan("booking", { sources: ["FAQ", "MANUAL"], needsBooking: true, needsPayment: false, chunkLimit: 3 });
  }
  if (isDiscoverNeed(text)) {
    return plan("greeting", { sources: [], needsCatalog: false, chunkLimit: 0 });
  }
  if (HANDOVER_HINT.test(t) || HANDOVER_HINT.test(text)) {
    return plan("handover", { sources: ["FAQ"], chunkLimit: 2 });
  }
  if (asksForLocation(text)) {
    return plan("faq", { sources: ["FAQ"], needsMap: true, chunkLimit: 2 });
  }
  if (asksForHours(text) && !looksLikeBooking(text)) {
    return plan("faq", { sources: ["FAQ"], needsHours: true, chunkLimit: 2 });
  }
  if (asksWhatTheyOffer(text)) {
    return plan("service", { sources: ["CATALOG"], needsCatalog: true, chunkLimit: 4 });
  }
  if (wantsStayReservation(text) || wantsStayReservation(t) || asksForReservationDetails(text)) {
    return plan("booking", { sources: ["FAQ", "MANUAL", "CATALOG"], needsBooking: true, needsPayment: true, needsCatalog: true, chunkLimit: 4 });
  }
  if (PAYMENT_HINT.test(t) || PAYMENT_HINT.test(text)) {
    return plan("payment", { sources: ["FAQ"], needsPayment: true, chunkLimit: 3 });
  }
  if (
    looksLikeBooking(text) ||
    looksLikeBooking(t) ||
    mentionsPartySize(text) ||
    parseBookingDateHint(text, "America/Lima")
  ) {
    return plan("booking", { sources: ["FAQ", "MANUAL"], needsBooking: true, needsPayment: true, chunkLimit: 4 });
  }
  if (PROMO_HINT.test(t) || PROMO_HINT.test(text)) {
    return plan("promo", { sources: ["CATALOG", "FAQ"], needsCatalog: true, needsPromo: true, chunkLimit: 4 });
  }
  if (PRODUCT_HINT.test(t) || PRODUCT_HINT.test(text)) {
    return plan("product", { sources: ["CATALOG"], needsCatalog: true, chunkLimit: 6 });
  }
  if (SERVICE_HINT.test(t) || SERVICE_HINT.test(text)) {
    return plan("service", { sources: ["CATALOG", "FAQ"], needsCatalog: true, chunkLimit: 6 });
  }
  if (FAQ_HINT.test(t) || FAQ_HINT.test(text) || /[¿?]/.test(text)) {
    return plan("faq", { sources: ["FAQ", "MANUAL"], chunkLimit: 6, needsMap: asksForLocation(text), needsHours: asksForHours(text) });
  }
  return plan("general", { sources: ["FAQ"], needsCatalog: false, chunkLimit: 2 });
}

export function searchTokens(text: string, max = 6): string[] {
  return fold(text)
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 2)
    .slice(0, max);
}

/** Calendar date (YYYY-MM-DD) hinted in Spanish, or null. */
export function parseBookingDateHint(
  text: string,
  timezone: string,
  now = new Date(),
): string | null {
  const t = fold(text);
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const dmy = t.match(/\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = dmy[3]
      ? dmy[3].length === 2
        ? 2000 + Number(dmy[3])
        : Number(dmy[3])
      : Number(dateInZone(now, timezone).slice(0, 4));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  const named = t.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|june|july|august|september|october|november|december)(?:(?:\s+de)?\s+(\d{4}))?\b/,
  );
  if (named) {
    const months: Record<string, number> = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      setiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    const month = months[named[2]];
    const day = Number(named[1]);
    const todayYmd = dateInZone(now, timezone);
    const year = named[3] ? Number(named[3]) : Number(todayYmd.slice(0, 4));
    if (month && day >= 1 && day <= 31) {
      const ymd = `${year}-${pad(month)}-${pad(day)}`;
      if (!named[3] && ymd < todayYmd) return `${year + 1}-${pad(month)}-${pad(day)}`;
      return ymd;
    }
  }

  const today = dateInZone(now, timezone);
  if (/\b(hoy|today)\b/.test(t)) return today;
  if (/\b(pasado\s*manana|day after tomorrow)\b/.test(t)) return addDays(today, 2);
  if (/\b(manana|tomorrow)\b/.test(t)) return addDays(today, 1);

  for (const [name, dow] of Object.entries(WEEKDAY_NAMES)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) return nextWeekday(today, dow);
  }
  return null;
}

export function dateInZone(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function nextWeekday(todayYmd: string, targetDow: number): string {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const delta = (targetDow - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fold(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
