import {
  askedForGuestCount,
  classifyIntent,
  detectReplyLocale,
  formatHoursReply,
  formatLocationReply,
  asksForPhotos,
  isDiscoverNeed,
  isPriceQuestion,
  isReservationFollowUp,
  keepConversationGoing,
  localizedReply,
  mentionsCatalogAddon,
  messageNeedsAppContext,
  parseBookingDateHint,
  formatDepositHoldReply,
  asksForReservationDetails,
  asksForAvailability,
  bookingUsesPlace,
  formatAvailabilityReply,
  isWebBookingLead,
  matchBookingPlace,
  shouldOfferDeposit,
  wantsStayReservation,
  inferCrmFromMessage,
} from "./bot-context";

describe("messageNeedsAppContext", () => {
  it("ignora un saludo corto", () => {
    expect(messageNeedsAppContext("hola")).toBe(false);
    expect(messageNeedsAppContext("Buenos días")).toBe(false);
  });

  it("detecta preguntas de precio o catálogo", () => {
    expect(messageNeedsAppContext("Hola, ¿cuánto cuesta el serum?")).toBe(true);
    expect(messageNeedsAppContext("tienen glamping disponible")).toBe(true);
    expect(messageNeedsAppContext("quiero acampar este sábado")).toBe(true);
    expect(messageNeedsAppContext("quiero reservar para el sábado")).toBe(true);
    expect(messageNeedsAppContext("how much is the lake entrance")).toBe(true);
    expect(messageNeedsAppContext("Hello")).toBe(false);
  });

  it("trata como consulta un mensaje largo", () => {
    expect(messageNeedsAppContext("Quisiera información de lo que ofrecen para el fin de semana")).toBe(true);
  });

  it("no carga folleto si solo piden ayuda o algo especial", () => {
    expect(messageNeedsAppContext("Me ayuda x favor")).toBe(false);
    expect(messageNeedsAppContext("Y deseo algo muy especial")).toBe(false);
    expect(isDiscoverNeed("Me ayuda x favor")).toBe(true);
    expect(isDiscoverNeed("quiero acampar")).toBe(false);
  });
});

describe("classifyIntent", () => {
  it("separa saludo, producto, reserva y FAQ", () => {
    expect(classifyIntent("hola").intent).toBe("greeting");
    expect(classifyIntent("cuánto cuesta el serum").intent).toBe("product");
    expect(classifyIntent("cuánto cuesta la entrada").intent).toBe("product");
    expect(classifyIntent("quiero acampar").intent).toBe("booking");
    expect(classifyIntent("quiero glamping").intent).toBe("booking");
    expect(classifyIntent("quiero reservar para el sábado").intent).toBe("booking");
    expect(classifyIntent("dónde queda el lago").intent).toBe("faq");
    expect(classifyIntent("hay alguna promoción").intent).toBe("promo");
    expect(classifyIntent("me pasas el número de cuenta").intent).toBe("booking");
    expect(classifyIntent("puedo pagar con tarjeta").intent).toBe("payment");
    expect(classifyIntent("hello").intent).toBe("greeting");
    expect(classifyIntent("how much is the entrance").intent).toBe("product");
    expect(classifyIntent("I want to book for Saturday").intent).toBe("booking");
  });

  it("solo carga pagos si preguntan por eso o reservan", () => {
    expect(classifyIntent("hola").needsPayment).toBe(false);
    expect(classifyIntent("cuánto cuesta el serum").needsPayment).toBe(false);
    expect(classifyIntent("cómo puedo pagar").needsPayment).toBe(true);
    expect(classifyIntent("quiero reservar para el sábado").needsPayment).toBe(true);
    expect(classifyIntent("Necesito reservar para la noche del sábado").needsPayment).toBe(true);
    expect(classifyIntent("quiero glamping").needsPayment).toBe(true);
  });

  it("en un saludo no carga precios ni catálogo", () => {
    const plan = classifyIntent("Buenos días");
    expect(plan.needsCatalog).toBe(false);
    expect(plan.needsBooking).toBe(false);
    expect(plan.sources).toEqual([]);
  });

  it("pide mapa u horario solo si el cliente lo pregunta", () => {
    expect(classifyIntent("dónde queda").needsMap).toBe(true);
    expect(classifyIntent("dónde queda").needsHours).toBe(false);
    expect(classifyIntent("cuál es el horario").needsHours).toBe(true);
    expect(classifyIntent("cuál es el horario").intent).toBe("faq");
    expect(classifyIntent("hola").needsMap).toBe(false);
    expect(classifyIntent("Y deseo algo muy especial").intent).toBe("greeting");
    expect(classifyIntent("Y deseo algo muy especial").needsCatalog).toBe(false);
  });

  it("sigue el hilo de reserva y no se queda mudo", () => {
    expect(isReservationFollowUp("Hola me avisa por favor")).toBe(true);
    expect(isReservationFollowUp("Si quedo reservada")).toBe(true);
    expect(isDiscoverNeed("Hola me avisa por favor")).toBe(false);
    expect(classifyIntent("Cómo nos podrían reservar").intent).toBe("booking");
    expect(classifyIntent("Hola me avisa por favor").intent).toBe("booking");
    expect(classifyIntent("31 de julio de 2026").intent).toBe("booking");
    expect(messageNeedsAppContext("Ok")).toBe(true);
    expect(keepConversationGoing("es", "Si quedo reservada")).toMatch(/confirma la reserva/);
    expect(asksForPhotos("Me pueden ayudar con fotos de las instalaciones?")).toBe(true);
    expect(asksForPhotos("hola")).toBe(false);
    expect(messageNeedsAppContext("fotos de las instalaciones")).toBe(true);
  });
});

describe("respuestas con iconos", () => {
  it("arma ubicación y horario por separado", () => {
    expect(formatLocationReply("es", "Ayllu", "https://maps.example/ayllu")).toContain("📍 *Ubicación*");
    expect(formatLocationReply("es", "Ayllu", "https://maps.example/ayllu")).toContain("https://maps.example/ayllu");
    expect(formatHoursReply("es", ["Lunes: 00:00-23:59", "Martes: 00:00-23:59"])).toBe(
      "🕐 *Horario*\nTodos los días, las 24 horas.",
    );
  });
});

describe("isPriceQuestion", () => {
  it("detecta precio y entrada, no un saludo", () => {
    expect(isPriceQuestion("cuánto cobran la entrada")).toBe(true);
    expect(isPriceQuestion("how much is the entrance")).toBe(true);
    expect(isPriceQuestion("hola")).toBe(false);
    expect(askedForGuestCount("¿Para cuántas personas van? Así te digo el valor de la entrada.")).toBe(
      true,
    );
    expect(askedForGuestCount("How many people are coming? Then I can tell you the entrance.")).toBe(
      true,
    );
  });
});

describe("detectReplyLocale", () => {
  it("elige inglés o español según el mensaje", () => {
    expect(detectReplyLocale("Hello")).toBe("en");
    expect(detectReplyLocale("how much is the entrance")).toBe("en");
    expect(detectReplyLocale("Hola")).toBe("es");
    expect(detectReplyLocale("cuánto cuesta la entrada")).toBe("es");
    expect(localizedReply({ reply: "Hola", replyEn: "Hi" }, "en")).toBe("Hi");
    expect(localizedReply({ reply: "Hola", replyEn: "Hi" }, "es")).toBe("Hola");
  });
});

describe("mentionsCatalogAddon", () => {
  it("reconoce acampar e implementos, no una tienda suelta", () => {
    expect(mentionsCatalogAddon("quiero acampar")).toBe(true);
    expect(mentionsCatalogAddon("necesito una tienda de campaña")).toBe(true);
    expect(mentionsCatalogAddon("tienen carpa")).toBe(true);
    expect(mentionsCatalogAddon("cuánto cuesta el serum")).toBe(false);
  });
});

describe("parseBookingDateHint", () => {
  const now = new Date("2026-09-09T15:00:00.000Z");

  it("entiende hoy, mañana y un día de la semana", () => {
    expect(parseBookingDateHint("para hoy", "America/Lima", now)).toBe("2026-09-09");
    expect(parseBookingDateHint("tomorrow at 10", "America/Lima", now)).toBe("2026-09-10");
    expect(parseBookingDateHint("mañana a las 10", "America/Lima", now)).toBe("2026-09-10");
    expect(parseBookingDateHint("quiero reservar para el sábado", "America/Lima", now)).toBe(
      "2026-09-12",
    );
  });

  it("lee día y mes sin año", () => {
    expect(parseBookingDateHint("para el 26 de septiembre", "America/Lima", now)).toBe("2026-09-26");
    expect(parseBookingDateHint("noche del 15 de octubre", "America/Lima", now)).toBe("2026-10-15");
  });

  it("lee fechas numéricas", () => {
    expect(parseBookingDateHint("el 15/09", "America/Lima", now)).toBe("2026-09-15");
    expect(parseBookingDateHint("para 2026-09-20", "America/Lima", now)).toBe("2026-09-20");
    expect(parseBookingDateHint("31 de julio de 2026", "America/Lima", now)).toBe("2026-07-31");
  });
});

describe("reserva con abono", () => {
  it("pide abono cuando ya hay fecha de estadía", () => {
    expect(wantsStayReservation("Necesito reservar para la noche del sábado")).toBe(true);
    expect(shouldOfferDeposit("Necesito reservar para la noche del sábado")).toBe(true);
    expect(shouldOfferDeposit("quiero glamping")).toBe(false);
    expect(shouldOfferDeposit("fotos de las instalaciones")).toBe(false);
    expect(asksForReservationDetails("necesito los datos para poder hacer la reserva")).toBe(true);
    expect(shouldOfferDeposit("me pasas los datos para reservar")).toBe(true);
    expect(shouldOfferDeposit("dame el número de cuenta")).toBe(true);
    expect(asksForAvailability("Pero si tiene disponible para hoy?")).toBe(true);
    expect(shouldOfferDeposit("Pero si tiene disponible para hoy?")).toBe(false);
    expect(classifyIntent("Pero si tiene disponible para hoy?").needsBooking).toBe(true);
    expect(classifyIntent("Pero si tiene disponible para hoy?").needsPayment).toBe(false);
    const places = [
      { id: "glamping", name: "Glamping" },
      { id: "botes", name: "Botes a remo" },
    ];
    expect(matchBookingPlace(places, "para 5 personas, glamping")?.id).toBe("glamping");
    expect(matchBookingPlace(places, "Tiene disponible los gampling")?.id).toBe("glamping");
    expect(isWebBookingLead("Hola, quiero reservar desde la web:\n• Experiencia: Glamping")).toBe(true);
    expect(shouldOfferDeposit("Hola, quiero reservar desde la web:\n• Fecha: 2026-10-10")).toBe(false);
    expect(bookingUsesPlace(places[0], "Glamping G01 · [u:glamping:1]")).toBe(true);
    expect(bookingUsesPlace(places[0], "mesa del restaurante")).toBe(false);
    const open = formatAvailabilityReply("es", {
      date: "2026-10-04",
      isToday: true,
      hasRoom: true,
      placeName: "Glamping",
    });
    expect(open).toContain("hoy");
    expect(open).toContain("Glamping");
    expect(open).not.toContain("transferencia");
    expect(open).not.toMatch(/\d/);
    const full = formatAvailabilityReply("es", {
      date: "2026-10-04",
      isToday: true,
      hasRoom: false,
      placeName: "Glamping",
    });
    expect(full).toContain("ocupado");
    expect(full).not.toMatch(/\d/);
    expect(classifyIntent("necesito los datos para poder hacer la reserva").needsPayment).toBe(true);
  });

  it("empuja el CRM según el chat", () => {
    expect(inferCrmFromMessage("hola")).toBeNull();
    expect(inferCrmFromMessage("cuánto cuesta acampar")?.stage).toBe("INTERESTED");
    expect(inferCrmFromMessage("quiero glamping")?.stage).toBe("INTERESTED");
    expect(inferCrmFromMessage("fotos de las instalaciones")?.stage).toBe("INTERESTED");
    expect(inferCrmFromMessage("me pasas los datos para reservar")?.stage).toBe("RESERVED");
    expect(inferCrmFromMessage("Necesito reservar para la noche del sábado")?.stage).toBe("RESERVED");
  });

  it("arma el bloque de transferencia como Tipo Pugro", () => {
    const reply = formatDepositHoldReply("es", "Necesito reservar glamping para el sábado", 50, [
      {
        type: "TRANSFER",
        bank: "Pichincha",
        accountType: "Ahorros",
        accountNumber: "2200004821",
        accountHolder: "AYLLU Lago",
      },
    ]);
    expect(reply).toContain("abono del 50%");
    expect(reply).toContain("el glamping");
    expect(reply).toContain("Datos para la transferencia:");
    expect(reply).toContain("🏦 Banco: Pichincha");
    expect(reply).toContain("— Tipo de cuenta: Ahorros");
    expect(reply).toContain("— Nº de cuenta: 2200004821");
    expect(reply).toContain("— Titular: AYLLU Lago");
  });
});
