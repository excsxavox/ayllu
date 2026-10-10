import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createCipheriv, randomBytes } from "crypto";

const prisma = new PrismaClient();

function encrypt(plain: string, keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

async function main() {
  const passwordHash = await bcrypt.hash("Admin1234", 12);
  const key = process.env.ENCRYPTION_KEY ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const admin = await prisma.user.upsert({
    where: { email: "admin@aylluu.local" },
    update: {},
    create: {
      email: "admin@aylluu.local",
      name: "Admin AYLLUU",
      passwordHash,
      platformRole: "PLATFORM_ADMIN",
    },
  });

  const alphaAdmin = await prisma.user.upsert({
    where: { email: "alpha@aylluu.local" },
    update: {},
    create: {
      email: "alpha@aylluu.local",
      name: "Admin Alpha",
      passwordHash,
      platformRole: "USER",
    },
  });

  const betaAdmin = await prisma.user.upsert({
    where: { email: "beta@aylluu.local" },
    update: {},
    create: {
      email: "beta@aylluu.local",
      name: "Admin Beta",
      passwordHash,
      platformRole: "USER",
    },
  });

  const alphaVoice = {
    botTone: "cálido",
    botSystemPrompt:
      "Atiendes WhatsApp de Ayllu como quien recibe en el jardín, no como un bot. Calma y cercanía. Un emoji de naturaleza (🌿 🌱) como mucho. Responde en el idioma del cliente. Cada mensaje se contesta según lo que la persona acaba de escribir, aunque el chat ya llevara rato. Solo hablas de este negocio: el lago, la entrada, glamping, acampar, pesca, botes, senderos, restaurante, reservas y pagos. Un saludo (hola, buenas) se responde con un saludo cordial y una pregunta abierta; no retomes precios ni preguntes para cuántas personas si este mensaje no habla de entrada o precio. Si preguntan si hay disponibilidad, revisa los cupos de ese día y di si está libre u ocupado. No envíes abono ni cuenta bancaria hasta que confirmen que quieren reservar. La entrada solo se cotiza si la piden en este mensaje, y ahí sí preguntas cuántos van si no lo dijeron. No envíes todo de una: mapa, horario o precios solo si lo piden. Si piden ubicación usa 📍; si piden horario usa 🕐. Si preguntan qué hay, nombra las experiencias en una o dos líneas. Si preguntan cómo reservar, pregunta qué quieren hacer y para qué día. No pidas nombre ni teléfono. Si no sabes algo o se sale del negocio, pasas con una persona.",
  };

  const alpha = await prisma.company.upsert({
    where: { slug: "alpha-demo" },
    update: { name: "Ayllu", bookingsEnabled: true, ...alphaVoice },
    create: {
      name: "Ayllu",
      slug: "alpha-demo",
      timezone: "America/Lima",
      bookingsEnabled: true,
      ...alphaVoice,
    },
  });

  const beta = await prisma.company.upsert({
    where: { slug: "beta-demo" },
    update: {},
    create: {
      name: "Beta Demo",
      slug: "beta-demo",
      timezone: "America/Lima",
      botTone: "formal",
      botSystemPrompt: "Eres el asistente de Beta, una tienda de tecnología.",
    },
  });

  await prisma.membership.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: alpha.id } },
    update: {},
    create: { userId: admin.id, companyId: alpha.id, role: "COMPANY_ADMIN" },
  });
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: beta.id } },
    update: {},
    create: { userId: admin.id, companyId: beta.id, role: "COMPANY_ADMIN" },
  });
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: alphaAdmin.id, companyId: alpha.id } },
    update: {},
    create: { userId: alphaAdmin.id, companyId: alpha.id, role: "COMPANY_ADMIN" },
  });
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: betaAdmin.id, companyId: beta.id } },
    update: {},
    create: { userId: betaAdmin.id, companyId: beta.id, role: "COMPANY_ADMIN" },
  });

  const alphaService =
    (await prisma.service.findFirst({ where: { companyId: alpha.id, name: "Limpieza facial" } })) ??
    (await prisma.service.create({
      data: {
        companyId: alpha.id,
        name: "Limpieza facial",
        description: "Sesión de 60 minutos con hidratación.",
        durationMinutes: 60,
        prices: {
          create: { companyId: alpha.id, amount: 120, currency: "USD", label: "regular", isDefault: true },
        },
      },
    }));

  const campCategory =
    (await prisma.category.findFirst({ where: { companyId: alpha.id, name: "Acampada" } })) ??
    (await prisma.category.create({ data: { companyId: alpha.id, name: "Acampada" } }));

  const campService =
    (await prisma.service.findFirst({ where: { companyId: alpha.id, name: "Acampar" } })) ??
    (await prisma.service.create({
      data: {
        companyId: alpha.id,
        categoryId: campCategory.id,
        name: "Acampar",
        description:
          "Reserva para acampar. Se agenda como servicio principal. Si necesitas tienda u otros implementos, se piden como complemento (hay stock limitado) y no se ofrecen sueltos.",
        durationMinutes: 60,
        prices: {
          create: { companyId: alpha.id, amount: 80, currency: "USD", label: "regular", isDefault: true },
        },
      },
    }));

  const tent = await prisma.product.findFirst({ where: { companyId: alpha.id, sku: "TIENDA-ACAMP" } });
  if (tent) {
    await prisma.product.update({
      where: { id: tent.id },
      data: {
        name: "Tienda de campaña",
        description:
          "Complemento de Acampar. Hay 5 tiendas. Se reserva solo junto a una cita de acampar; no se vende ni se ofrece como producto principal.",
        isAddon: true,
        stock: 5,
        parentServiceId: campService.id,
        categoryId: campCategory.id,
        isActive: true,
      },
    });
  } else {
    await prisma.product.create({
      data: {
        companyId: alpha.id,
        categoryId: campCategory.id,
        parentServiceId: campService.id,
        name: "Tienda de campaña",
        description:
          "Complemento de Acampar. Hay 5 tiendas. Se reserva solo junto a una cita de acampar; no se vende ni se ofrece como producto principal.",
        sku: "TIENDA-ACAMP",
        isAddon: true,
        stock: 5,
        prices: {
          create: { companyId: alpha.id, amount: 35, currency: "USD", label: "regular", isDefault: true },
        },
      },
    });
  }

  await prisma.service.updateMany({
    where: { companyId: alpha.id, name: "Limpieza facial" },
    data: { isActive: false },
  });
  await prisma.product.updateMany({
    where: { companyId: alpha.id, sku: "SERUM-C" },
    data: { isActive: false },
  });

  const lakeServices = [
    {
      name: "Glamping",
      description:
        "Domos junto al lago. Se reserva por unidad y se anota cuántas personas van. Para asegurar la noche se pide un abono del 50% por transferencia.",
    },
    { name: "Pesca", description: "Sitios de pesca en el lago. Se reserva el puesto." },
    { name: "Botes a remo", description: "Botes para recorrer el lago." },
    { name: "Senderos", description: "Caminatas por los senderos de Ayllu." },
    { name: "Restaurante", description: "Mesas en el restaurante del lago." },
  ];
  for (const item of lakeServices) {
    const existing = await prisma.service.findFirst({ where: { companyId: alpha.id, name: item.name } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { description: item.description, isActive: true },
      });
    } else {
      await prisma.service.create({
        data: { companyId: alpha.id, name: item.name, description: item.description, isActive: true },
      });
    }
  }

  await prisma.service.updateMany({
    where: { companyId: alpha.id, name: "Entrada al lago" },
    data: { isActive: false },
  });
  const entryCategory =
    (await prisma.category.findFirst({ where: { companyId: alpha.id, name: "Entradas" } })) ??
    (await prisma.category.create({ data: { companyId: alpha.id, name: "Entradas" } }));
  const entryProduct =
    (await prisma.product.findFirst({ where: { companyId: alpha.id, sku: "ENTRADA-LAGO" } })) ??
    (await prisma.product.create({
      data: {
        companyId: alpha.id,
        categoryId: entryCategory.id,
        name: "Entrada al lago",
        description: "Ticket de ingreso al lago, por persona y según edad.",
        sku: "ENTRADA-LAGO",
        isActive: true,
      },
    }));
  await prisma.product.update({
    where: { id: entryProduct.id },
    data: {
      name: "Entrada al lago",
      description: "Ticket de ingreso al lago, por persona y según edad.",
      categoryId: entryCategory.id,
      isAddon: false,
      isActive: true,
    },
  });
  await prisma.price.deleteMany({ where: { productId: entryProduct.id } });
  await prisma.price.createMany({
    data: [
      { companyId: alpha.id, productId: entryProduct.id, amount: 0, currency: "USD", label: "menor de 5", isDefault: false },
      { companyId: alpha.id, productId: entryProduct.id, amount: 1, currency: "USD", label: "niño 5-12", isDefault: true },
      { companyId: alpha.id, productId: entryProduct.id, amount: 2, currency: "USD", label: "mayor 13+", isDefault: false },
    ],
  });

  if (!(await prisma.product.findFirst({ where: { companyId: alpha.id, sku: "SERUM-C" } }))) {
    await prisma.product.create({
      data: {
        companyId: alpha.id,
        name: "Serum vitamina C",
        description: "Uso diario, 30ml.",
        sku: "SERUM-C",
        prices: {
          create: { companyId: alpha.id, amount: 89, currency: "USD", label: "regular", isDefault: true },
        },
      },
    });
  }

  if (!(await prisma.product.findFirst({ where: { companyId: beta.id, sku: "LAP-14" } }))) {
    await prisma.product.create({
      data: {
        companyId: beta.id,
        name: "Laptop Pro 14",
        description: "Portátil para trabajo, 16GB RAM.",
        sku: "LAP-14",
        prices: {
          create: { companyId: beta.id, amount: 4299, currency: "USD", label: "regular", isDefault: true },
        },
      },
    });
  }

  await prisma.promotion.deleteMany({
    where: { companyId: alpha.id, name: { in: ["Promo primavera"] } },
  });
  const boatService = await prisma.service.findFirst({ where: { companyId: alpha.id, name: "Botes a remo" } });
  const aylluPromos = [
    {
      name: "Lago entre semana",
      description: "15% en acampar de lunes a jueves. Si reservan por WhatsApp, usa el código LAGO.",
      discountType: "PERCENT" as const,
      discountValue: 15,
      code: "LAGO",
      isActive: true,
      startsAt: null as Date | null,
      endsAt: null as Date | null,
      serviceId: campService.id,
    },
    {
      name: "2x1 en botes",
      description: "Dos personas reman por el precio de una, de lunes a viernes. Código BOTE.",
      discountType: "BOGO" as const,
      discountValue: 1,
      code: "BOTE",
      isActive: true,
      startsAt: new Date("2026-10-01T05:00:00.000Z"),
      endsAt: new Date("2026-10-31T04:59:59.000Z"),
      serviceId: boatService?.id ?? null,
    },
    {
      name: "Bienvenida al lago",
      description: "10 dólares de descuento en la primera reserva. Sin código.",
      discountType: "FIXED" as const,
      discountValue: 10,
      code: null as string | null,
      isActive: true,
      startsAt: null,
      endsAt: null,
      serviceId: null as string | null,
    },
    {
      name: "Temporada alta",
      description: "10% en todas las experiencias. La pausamos fuera de temporada.",
      discountType: "PERCENT" as const,
      discountValue: 10,
      code: "ALTA",
      isActive: false,
      startsAt: null,
      endsAt: null,
      serviceId: null,
    },
  ];
  for (const promo of aylluPromos) {
    const existing = await prisma.promotion.findFirst({ where: { companyId: alpha.id, name: promo.name } });
    const data = {
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      code: promo.code,
      isActive: promo.isActive,
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
    };
    if (existing) {
      await prisma.promotionItem.deleteMany({ where: { promotionId: existing.id } });
      await prisma.promotion.update({
        where: { id: existing.id },
        data: {
          ...data,
          items: promo.serviceId ? { create: { serviceId: promo.serviceId } } : undefined,
        },
      });
    } else {
      await prisma.promotion.create({
        data: {
          companyId: alpha.id,
          name: promo.name,
          ...data,
          items: promo.serviceId ? { create: { serviceId: promo.serviceId } } : undefined,
        },
      });
    }
  }

  await prisma.tag.createMany({
    data: [
      { companyId: alpha.id, name: "vip", color: "#7c3aed" },
      { companyId: beta.id, name: "mayorista", color: "#2563eb" },
    ],
    skipDuplicates: true,
  });

  const alphaRules = [
    {
      name: "Saludo Alpha",
      type: "GREETING" as const,
      priority: 10,
      conditions: { firstMessageOnly: true, when: "greeting" },
      actions: {
        reply:
          "¡Hola! 🌿 Bienvenido a Ayllu. Un espacio junto al lago para disfrutar, descansar y crear momentos especiales. ¿Cómo podemos ayudarte hoy?",
        replyEn: "Hi 🌿 Welcome to Ayllu, by the lake. What would you like to do?",
      },
    },
    {
      name: "Hablar con humano",
      type: "HANDOVER" as const,
      priority: 20,
      conditions: { when: "handover", keywords: ["asesor", "humano", "alguien", "agent", "human", "someone"] },
      actions: {
        transferToHuman: true,
        reply: "Claro 🍃 Te paso con alguien del equipo. En un momentito te acompaña 🌿",
        replyEn: "Of course 🍃 I'll connect you with someone from the team. They'll be with you shortly 🌿",
      },
    },
    {
      name: "Grupo de 12 o más",
      type: "HANDOVER" as const,
      priority: 12,
      conditions: { minGuests: 12, when: "group" },
      actions: {
        transferToHuman: true,
        reply: "Pasar el caso a una persona. No confirmar ni cotizar un grupo grande de forma automática.",
        replyEn: "Hand the case to a person. Do not confirm or quote a large group automatically.",
      },
    },
    {
      name: "Acampar e implementos",
      type: "KEYWORD" as const,
      priority: 18,
      conditions: { when: "addon", keywords: ["acampar", "camping", "tienda de campaña", "carpa", "implementos", "tent"] },
      actions: {
        reply:
          "Acampar se agenda como reserva 🌿 La tienda de campaña es un complemento (hay 5) y se pide solo si vas a acampar; no se ofrece suelta.",
        replyEn:
          "Camping is booked as a reservation 🌿 The tent is an add-on (we have 5) and only comes with camping; we don't offer it on its own.",
      },
    },
    {
      name: "Entrada al lago",
      type: "KEYWORD" as const,
      priority: 16,
      conditions: { when: "prices", keywords: ["entrada", "ingreso", "cuánto cuesta entrar", "cuesta la entrada", "entrance", "lake ticket"] },
      actions: {
        reply: "¿Para cuántas personas es la entrada? Con eso te digo el valor 🌿",
        replyEn: "How many people is the entrance for? Then I can tell you the price 🌿",
      },
    },
  ];

  await prisma.businessRule.updateMany({
    where: { companyId: alpha.id, type: "HOURS" },
    data: { enabled: false },
  });

  for (const rule of alphaRules) {
    const existing = await prisma.businessRule.findFirst({
      where: {
        companyId: alpha.id,
        OR: [
          { name: rule.name },
          ...(rule.name === "Grupo de 12 o más" ? [{ name: "Grupo de 15 o más" }] : []),
        ],
      },
    });
    if (existing) {
      const keepReply = rule.type === "GREETING" && existing.actions && typeof existing.actions === "object";
      await prisma.businessRule.update({
        where: { id: existing.id },
        data: {
          name: rule.name,
          priority: rule.priority,
          enabled: true,
          conditions: rule.conditions,
          actions: keepReply ? existing.actions : rule.actions,
        },
      });
    } else {
      await prisma.businessRule.create({
        data: { companyId: alpha.id, enabled: true, ...rule },
      });
    }
  }

  if ((await prisma.businessRule.count({ where: { companyId: beta.id } })) === 0) {
    await prisma.businessRule.create({
      data: {
        companyId: beta.id,
        name: "Saludo Beta",
        type: "GREETING",
        priority: 10,
        enabled: true,
        conditions: { firstMessageOnly: true },
        actions: { reply: "Bienvenido a Beta Tech. ¿En qué equipo te ayudamos?" },
      },
    });
  }

  const knowledgeTopics = [
    {
      title: "Preguntas frecuentes",
      content:
        "Ayllu es una reserva junto al lago. El asistente atiende las 24 horas y solo habla de este negocio. Contesta según el mensaje que acaba de llegar, aunque ya hubiera conversación. Un saludo se responde con un saludo cordial y una pregunta abierta; no se retoma la entrada ni se pide el número de personas si no lo preguntaron en ese mensaje. No listes todas las actividades, precios, mapa ni horario de una sola vez.",
    },
    {
      title: "Horario",
      content: "Ayllu atiende todos los días, las 24 horas. El asistente de WhatsApp también responde a cualquier hora.",
    },
    {
      title: "Entrada al lago",
      content:
        "La entrada se cotiza solo si en este mensaje preguntan precio o entrada. Si no dijeron cuántas personas, se pregunta entonces. No se vuelve a pedir el número de personas cuando saludan o cambian de tema. La entrada cuesta 1 dólar los niños de 5 a 12 años y 2 dólares los mayores. Los menores de 5 años no pagan.",
    },
    {
      title: "Acampar",
      content:
        "Acampar se agenda como reserva. La tienda de campaña es un complemento de acampar (hay 5) y no se ofrece suelta.",
    },
    {
      title: "Grupos",
      content: "Grupos de 12 o más los atiende una persona del equipo. El asistente no confirma ni cotiza ese grupo.",
    },
  ];
  for (const topic of knowledgeTopics) {
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { companyId: alpha.id, title: topic.title, sourceType: "FAQ" },
    });
    if (existing) {
      await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { content: topic.content, sourceType: "FAQ" },
      });
      await prisma.knowledgeChunk.deleteMany({ where: { documentId: existing.id } });
      await prisma.knowledgeChunk.create({
        data: { companyId: alpha.id, documentId: existing.id, content: `${topic.title}\n${topic.content}` },
      });
    } else {
      await prisma.knowledgeDocument.create({
        data: {
          companyId: alpha.id,
          title: topic.title,
          sourceType: "FAQ",
          content: topic.content,
          chunks: {
            create: { companyId: alpha.id, content: `${topic.title}\n${topic.content}` },
          },
        },
      });
    }
  }

  const priceReply = {
    title: "Precios",
    body: "La entrada al lago es 1 dólar niños (5 a 12 años) y 2 dólares mayores; menores de 5 no pagan 🌸 También puedes reservar glamping, acampar, pesca, botes y restaurante. ¿Qué te gustaría reservar? 🌿",
    shortcut: "/precio",
    keywords: ["precio", "cuesta", "costo", "entrada"],
  };
  const existingReply = await prisma.cannedReply.findFirst({
    where: { companyId: alpha.id, title: "Precios" },
  });
  if (existingReply) {
    await prisma.cannedReply.update({ where: { id: existingReply.id }, data: priceReply });
  } else {
    await prisma.cannedReply.create({ data: { companyId: alpha.id, ...priceReply } });
  }

  await prisma.alertSetting.createMany({
    data: ["NEW_CONVERSATION", "HUMAN_TAKEOVER", "BOT_FALLBACK", "OUTSIDE_HOURS", "NEEDS_REPLY"].flatMap(
      (type) => [
        { companyId: alpha.id, type: type as never, enabled: type !== "OUTSIDE_HOURS" },
        { companyId: beta.id, type: type as never, enabled: true },
      ],
    ),
    skipDuplicates: true,
  });
  await prisma.alertSetting.updateMany({
    where: { companyId: alpha.id, type: "OUTSIDE_HOURS" },
    data: { enabled: false },
  });

  await prisma.whatsAppAccount.upsert({
    where: { provider_phoneNumberId: { provider: "META", phoneNumberId: "alpha-demo-phone" } },
    update: {},
    create: {
      companyId: alpha.id,
      provider: "META",
      phoneNumberId: "alpha-demo-phone",
      displayPhone: "+51 900 000 001",
      verifyTokenEnc: encrypt("alpha-verify", key),
      isActive: true,
    },
  });

  await prisma.whatsAppAccount.upsert({
    where: { provider_phoneNumberId: { provider: "META", phoneNumberId: "beta-demo-phone" } },
    update: {},
    create: {
      companyId: beta.id,
      provider: "META",
      phoneNumberId: "beta-demo-phone",
      displayPhone: "+51 900 000 002",
      verifyTokenEnc: encrypt("beta-verify", key),
      isActive: true,
    },
  });

  const { ensureCompanyMessaging } = await import("../src/channels/defaults");
  await ensureCompanyMessaging(prisma, alpha.id);
  await ensureCompanyMessaging(prisma, beta.id);

  await prisma.botFlow.updateMany({
    where: { companyId: alpha.id, isDefault: true },
    data: {
      tone: alphaVoice.botTone,
      systemPrompt: alphaVoice.botSystemPrompt,
    },
  });

  const socialFlow = await prisma.botFlow.findFirst({
    where: { companyId: alpha.id, name: "Atención en redes" },
  });
  if (socialFlow) {
    await prisma.channel.updateMany({ where: { flowId: socialFlow.id }, data: { flowId: null } });
    await prisma.businessRule.updateMany({ where: { flowId: socialFlow.id }, data: { flowId: null } });
    await prisma.botFlow.delete({ where: { id: socialFlow.id } });
  }
  await prisma.channel.deleteMany({
    where: { companyId: alpha.id, type: { in: ["INSTAGRAM", "MESSENGER"] } },
  });

  const pichincha = await prisma.paymentMethod.findFirst({
    where: { companyId: alpha.id, bank: "Pichincha" },
  });
  if (!pichincha) {
    await prisma.paymentMethod.create({
      data: {
        companyId: alpha.id,
        type: "TRANSFER",
        name: "Banco Pichincha",
        isActive: true,
        bank: "Pichincha",
        accountType: "Ahorros",
        accountNumber: "2200004821",
        accountHolder: "AYLLU Lago",
      },
    });
  } else if (!pichincha.isActive) {
    await prisma.paymentMethod.update({ where: { id: pichincha.id }, data: { isActive: true } });
  }

  await prisma.bookingSettings.upsert({
    where: { companyId: alpha.id },
    update: { depositPercent: 50 },
    create: {
      companyId: alpha.id,
      title: "Agenda Alpha",
      mode: "SERVICES",
      slotMinutes: 60,
      maxPerDay: 12,
      weeklyHours: {
        mon: [{ start: "09:00", end: "18:00" }],
        tue: [{ start: "09:00", end: "18:00" }],
        wed: [{ start: "09:00", end: "18:00" }],
        thu: [{ start: "09:00", end: "18:00" }],
        fri: [{ start: "09:00", end: "18:00" }],
        sat: [{ start: "09:00", end: "14:00" }],
        sun: [{ start: "09:00", end: "14:00" }],
      },
      requirePhone: true,
      requireEmail: false,
      depositPercent: 50,
    },
  });

  const savedPlaces = await prisma.bookingSettings.findUnique({
    where: { companyId: alpha.id },
    select: { places: true },
  });
  const currentPlaces = Array.isArray(savedPlaces?.places)
    ? (savedPlaces.places as Array<{ id: string }>)
    : [];
  if (currentPlaces.length && !currentPlaces.some((p) => p.id === "acampar")) {
    await prisma.bookingSettings.update({
      where: { companyId: alpha.id },
      data: {
        places: [
          ...currentPlaces,
          { id: "acampar", name: "Acampar", icon: "tent", unitCount: 6, x: 40, y: 28, trackGuests: true },
        ],
      },
    });
  }

  const limaDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const limaAt = (hour: number) => new Date(`${limaDay}T${String(hour).padStart(2, "0")}:00:00-05:00`);
  const already = await prisma.booking.count({
    where: { companyId: alpha.id, startsAt: { gte: limaAt(0), lt: limaAt(23) } },
  });
  if (already === 0) {
    await prisma.booking.createMany({
      data: [
        {
          companyId: alpha.id,
          serviceId: alphaService.id,
          customerName: "Lucía Pérez",
          customerPhone: "999111222",
          notes: "2 personas",
          startsAt: limaAt(10),
          endsAt: limaAt(11),
          status: "CONFIRMED",
          paymentStatus: "DEPOSIT",
          source: "PANEL",
        },
        {
          companyId: alpha.id,
          serviceId: alphaService.id,
          customerName: "Carlos Rivas",
          customerPhone: "999333444",
          notes: "Llegó sin cita",
          startsAt: limaAt(12),
          endsAt: limaAt(13),
          status: "CONFIRMED",
          paymentStatus: "PENDING",
          source: "MANUAL",
        },
        {
          companyId: alpha.id,
          serviceId: alphaService.id,
          customerName: "Ana Torres",
          customerPhone: "999555666",
          startsAt: limaAt(16),
          endsAt: limaAt(17),
          status: "PENDING",
          paymentStatus: "PENDING",
          source: "BOT",
        },
      ],
    });
  }

  console.log("Seed OK. Entra con el correo y la contraseña de tu usuario.");
  console.log("  Piso (reservas en el lugar): http://localhost:3005");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
