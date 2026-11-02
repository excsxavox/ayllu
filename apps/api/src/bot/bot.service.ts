import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { existsSync } from "fs";
import { join } from "path";
import { Queue } from "bullmq";
import { NormalizedInboundMessage } from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RulesService } from "../rules/rules.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { LlmService } from "../knowledge/llm.service";
import { WhatsAppAdapterService } from "../whatsapp/whatsapp-adapter.service";
import { CryptoService } from "../common/crypto.service";
import { AlertsService } from "../alerts/alerts.service";
import { RepliesService } from "../replies/replies.service";
import { BookingsService } from "../bookings/bookings.service";
import { PaymentsService } from "../payments/payments.service";
import { PaymentProofService } from "./payment-proof.service";
import { isReceiptMedia } from "../payments/receipt-match";
import {
  addDays,
  askedForGuestCount,
  asksForHours,
  asksForLocation,
  asksForPhotos,
  classifyIntent,
  crmStageRank,
  asksForAvailability,
  bookingUsesPlace,
  formatAvailabilityReply,
  isWebBookingLead,
  matchBookingPlace,
  formatDepositHoldReply,
  inferCrmFromMessage,
  shouldOfferDeposit,
  dateInZone,
  detectReplyLocale,
  formatHoursReply,
  formatLocationReply,
  isGreetingOnly,
  isPriceQuestion,
  keepConversationGoing,
  localizedReply,
  looksLikeBooking,
  wantsStayReservation,
  mentionsCatalogAddon,
  messageNeedsAppContext,
  parseBookingDateHint,
  searchTokens,
} from "./bot-context";
import { ensureCompanyMessaging } from "../channels/defaults";
import { normalizePhone } from "../common/phone";
import type { BotFlow, Channel, Company, Contact, Conversation, ReplyMode, WhatsAppAccount } from "@prisma/client";

const BOT_DEBOUNCE_MS = Number(process.env.BOT_DEBOUNCE_MS ?? 4000);

function moneyLabel(amount: unknown, currency: string) {
  const n = Number(amount);
  const value = Number.isFinite(n) ? String(n) : String(amount ?? "");
  if (currency === "USD") return `$${value}`;
  if (currency === "PEN") return `S/ ${value}`;
  return `${value} ${currency}`;
}

export type ComposeJobData = {
  conversationId: string;
  inboundMessageId: string;
  from: string;
};

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly knowledge: KnowledgeService,
    private readonly llm: LlmService,
    private readonly adapter: WhatsAppAdapterService,
    private readonly crypto: CryptoService,
    private readonly alerts: AlertsService,
    private readonly replies: RepliesService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly proofs: PaymentProofService,
    @InjectQueue("whatsapp-inbound") private readonly inboundQueue: Queue,
  ) {}

  async handleInbound(message: NormalizedInboundMessage) {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        phoneNumberId: message.phoneNumberId,
        provider: message.provider,
        isActive: true,
      },
      include: { company: true, channel: { include: { flow: true } } },
    });
    if (!account) {
      this.logger.warn(`Cuenta WhatsApp no encontrada: ${message.phoneNumberId}`);
      return { skipped: true };
    }
    return this.handleChannelInbound({
      company: account.company,
      channel: account.channel,
      account,
      from: message.from,
      contactName: message.contactName,
      text: message.text,
      type: message.type,
      mediaId: message.mediaId,
      mimeType: message.mimeType,
      providerMessageId: message.providerMessageId,
      raw: message.raw,
      waitForMore: !isReceiptMedia(message.type),
    });
  }

  async handleChannelInbound(params: {
    company: Company;
    channel?: (Channel & { flow: BotFlow | null }) | null;
    account?: WhatsAppAccount | null;
    from: string;
    contactName?: string;
    text: string;
    type?: string;
    mediaId?: string;
    mimeType?: string;
    providerMessageId?: string;
    raw?: unknown;
    waitForMore?: boolean;
  }) {
    const companyId = params.company.id;
    await ensureCompanyMessaging(this.prisma, companyId);

    let channel = params.channel;
    if (!channel) {
      const fallback = await this.prisma.channel.findFirst({
        where: {
          companyId,
          ...(params.account ? { OR: [{ id: params.account.channelId ?? "" }, { type: "WHATSAPP" }] } : { type: "WEB" }),
        },
        include: { flow: true },
        orderBy: { createdAt: "asc" },
      });
      channel = fallback;
    }
    if (!channel) {
      this.logger.warn(`Canal no encontrado para ${companyId}`);
      return { skipped: true };
    }

    const flow =
      channel.flow ??
      (await this.prisma.botFlow.findFirst({
        where: { companyId, isDefault: true },
      }));

    const phone = normalizePhone(params.from) || params.from;
    const existing = await this.prisma.contact.findFirst({
      where: {
        companyId,
        OR: [{ phone }, { phone: params.from }, { waId: phone }, { waId: params.from }],
      },
    });
    let contact = existing
      ? await this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: params.contactName ?? undefined,
            waId: phone,
            source: existing.source === "MANUAL" ? "WHATSAPP" : undefined,
            stage: existing.stage === "NEW" ? "TALKING" : undefined,
          },
        })
      : await this.prisma.contact.create({
          data: {
            companyId,
            phone,
            waId: phone,
            name: params.contactName,
            audience: "CLIENT",
            source: "WHATSAPP",
            stage: "NEW",
          },
        });
    contact = await this.applyCrmFromChat({
      companyId,
      contact,
      text: isReceiptMedia(params.type) ? `${params.text || ""} comprobante de pago` : params.text,
      timezone: params.company.timezone,
    });

    const conversation = await this.prisma.conversation.upsert({
      where: { channelId_contactId: { channelId: channel.id, contactId: contact.id } },
      update: {
        lastMessageAt: new Date(),
        whatsappAccountId: params.account?.id ?? undefined,
      },
      create: {
        companyId,
        contactId: contact.id,
        channelId: channel.id,
        whatsappAccountId: params.account?.id,
        status: "BOT",
      },
    });

    const duplicate = params.providerMessageId
      ? await this.prisma.message.findFirst({
          where: { conversationId: conversation.id, providerMessageId: params.providerMessageId },
        })
      : null;
    if (duplicate) return { duplicate: true };

    const saved = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        type: params.type ?? "text",
        content: params.text,
        providerMessageId: params.providerMessageId,
        rawPayload: (params.raw as object) ?? undefined,
      },
    });

    const inboundCount = await this.prisma.message.count({
      where: { conversationId: conversation.id, direction: "INBOUND" },
    });

    if (isReceiptMedia(params.type)) {
      if (inboundCount <= 1) {
        await this.alerts.raise({
          companyId,
          type: "NEW_CONVERSATION",
          title: `Nueva conversación · ${channel.name}`,
          body: `${contact.name || contact.phone}: comprobante de pago`,
          conversationId: conversation.id,
        });
      }
      const reply = await this.proofs.review({
        companyId,
        conversation,
        contact,
        account: params.account,
        mediaId: params.mediaId,
        mimeType: params.mimeType,
        caption: params.text,
        locale: detectReplyLocale(params.text || "hola"),
      });
      if (contact.audience !== "CONTACT" && !conversation.humanTakeover && channel.isActive) {
        await this.sendAndStore({
          conversationId: conversation.id,
          accountId: params.account?.id,
          to: params.from,
          text: reply,
        });
      }
      return { ok: true, paymentProof: true, conversationId: conversation.id, channelId: channel.id };
    }

    if (contact.audience === "CONTACT") {
      await this.alerts.raise({
        companyId,
        type: "NEEDS_REPLY",
        title: "Contacto · el bot no responde",
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
      return { skippedBot: true, reason: "contact_audience", conversationId: conversation.id, channelId: channel.id };
    }

    if (inboundCount <= 1) {
      await this.alerts.raise({
        companyId,
        type: "NEW_CONVERSATION",
        title: `Nueva conversación · ${channel.name}`,
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
    }

    if (conversation.humanTakeover || conversation.status === "HUMAN") {
      await this.alerts.raise({
        companyId,
        type: "NEEDS_REPLY",
        title: "Mensaje en espera de un asesor",
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
      return { queuedForHuman: true, conversationId: conversation.id, channelId: channel.id };
    }

    if (params.waitForMore) {
      try {
        await this.inboundQueue.add(
          "compose",
          {
            conversationId: conversation.id,
            inboundMessageId: saved.id,
            from: params.from,
          } satisfies ComposeJobData,
          {
            delay: Number.isFinite(BOT_DEBOUNCE_MS) ? Math.max(1500, BOT_DEBOUNCE_MS) : 4000,
            removeOnComplete: 1000,
            attempts: 4,
            backoff: { type: "exponential", delay: 2000 },
          },
        );
        this.logger.log(`Esperando más mensajes de ${params.from} (${conversation.id})`);
        return { deferred: true, conversationId: conversation.id, channelId: channel.id };
      } catch (err) {
        this.logger.error(`Cola no disponible, respondo ya: ${(err as Error).message}`);
      }
    }

    return this.respondToConversation({
      company: params.company,
      channel,
      flow,
      contact,
      conversation,
      account: params.account,
      from: params.from,
      text: params.text,
      inboundCount,
    });
  }

  async composeDeferredReply(job: ComposeJobData) {
    try {
      const inbound = await this.prisma.message.findUnique({
        where: { id: job.inboundMessageId },
      });
      if (!inbound) return { skipped: true, reason: "missing_inbound" };

      const newer = await this.prisma.message.findFirst({
        where: {
          conversationId: job.conversationId,
          direction: "INBOUND",
          createdAt: { gt: inbound.createdAt },
        },
        select: { id: true },
      });
      if (newer) return { skipped: true, reason: "waiting_more" };

      const conversation = await this.prisma.conversation.findUnique({
        where: { id: job.conversationId },
        include: {
          company: true,
          contact: true,
          channel: { include: { flow: true } },
        },
      });
      if (!conversation?.channel) return { skipped: true, reason: "no_conversation" };
      if (conversation.humanTakeover || conversation.status === "HUMAN") {
        return { skipped: true, reason: "human" };
      }
      if (conversation.contact.audience === "CONTACT") {
        return { skipped: true, reason: "contact_audience" };
      }

      const lastOutbound = await this.prisma.message.findFirst({
        where: { conversationId: conversation.id, direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const batch = await this.prisma.message.findMany({
        where: {
          conversationId: conversation.id,
          direction: "INBOUND",
          ...(lastOutbound ? { createdAt: { gt: lastOutbound.createdAt } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: 8,
      });
      const text =
        batch
          .map((m) => m.content.trim())
          .filter(Boolean)
          .join("\n") || inbound.content.trim();
      if (!text) return { skipped: true, reason: "empty_batch" };

      const inboundCount = await this.prisma.message.count({
        where: { conversationId: conversation.id, direction: "INBOUND" },
      });
      const account = conversation.whatsappAccountId
        ? await this.prisma.whatsAppAccount.findUnique({ where: { id: conversation.whatsappAccountId } })
        : null;
      const flow =
        conversation.channel.flow ??
        (await this.prisma.botFlow.findFirst({
          where: { companyId: conversation.companyId, isDefault: true },
        }));

      return await this.respondToConversation({
        company: conversation.company,
        channel: conversation.channel,
        flow,
        contact: conversation.contact,
        conversation,
        account,
        from: job.from,
        text,
        inboundCount,
      });
    } catch (err) {
      this.logger.error(`Compose falló, igual respondo: ${(err as Error).message}`);
      return this.recoverReply(job, (err as Error).message);
    }
  }

  private async recoverReply(job: ComposeJobData, reason: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: job.conversationId },
      include: { contact: true },
    });
    if (!conversation || conversation.humanTakeover || conversation.contact.audience === "CONTACT") {
      return { skipped: true, reason: "recover_blocked" };
    }
    const inbound = await this.prisma.message.findUnique({ where: { id: job.inboundMessageId } });
    const locale = detectReplyLocale(inbound?.content || job.from);
    const text = keepConversationGoing(locale, inbound?.content || "");
    await this.sendAndStore({
      conversationId: conversation.id,
      accountId: conversation.whatsappAccountId ?? undefined,
      to: job.from,
      text,
    });
    await this.alerts.raise({
      companyId: conversation.companyId,
      type: "BOT_FALLBACK",
      title: "El bot recuperó una respuesta",
      body: reason.slice(0, 180),
      conversationId: conversation.id,
    });
    return { recovered: true, conversationId: conversation.id, replies: [text] };
  }

  private async respondToConversation(params: {
    company: Company;
    channel: Channel & { flow: BotFlow | null };
    flow: BotFlow | null;
    contact: Contact;
    conversation: Conversation;
    account?: WhatsAppAccount | null;
    from: string;
    text: string;
    inboundCount: number;
  }) {
    const { company, channel, flow, contact, conversation } = params;
    const companyId = company.id;
    const recent = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { direction: true, content: true },
    });
    const alreadyReplied = recent.some((m) => m.direction === "OUTBOUND");
    const lastOutbound = recent.find((m) => m.direction === "OUTBOUND")?.content ?? "";
    const greetingOnly = isGreetingOnly(params.text);
    const awaitingGuests = askedForGuestCount(lastOutbound) && !greetingOnly;
    const guests = this.rules.parseGuestCount(params.text, { allowBare: awaitingGuests });
    const priceAsk =
      (isPriceQuestion(params.text) && !asksForAvailability(params.text)) ||
      (awaitingGuests && guests == null && !messageNeedsAppContext(params.text));

    const hits = await this.rules.evaluate({
      companyId,
      flowId: flow?.id,
      timezone: params.company.timezone,
      text: params.text,
      isFirstMessage: params.inboundCount <= 1,
      isGreetingOnly: isGreetingOnly(params.text),
      alreadyReplied,
      humanTakeover: conversation.humanTakeover,
      guests,
    });

    const locale = detectReplyLocale(/[a-záéíóúñ]{3,}/i.test(params.text) ? params.text : lastOutbound || params.text);
    const askApp = messageNeedsAppContext(params.text);
    const replies: string[] = [];
    let transfer = false;
    let tagId: string | undefined;
    let promotionId: string | undefined;

    for (const hit of hits) {
      if (hit.type === "FALLBACK") continue;
      if (askApp && (hit.type === "GREETING" || hit.type === "KEYWORD")) continue;
      const silentHandover = Boolean(hit.conditions.minGuests);
      const fixed = silentHandover ? undefined : localizedReply(hit.actions, locale);
      if (fixed) replies.push(fixed);
      if (hit.actions.transferToHuman || hit.type === "HANDOVER") transfer = true;
      if (hit.conditions.tagId) tagId = hit.conditions.tagId;
      if (hit.conditions.promotionId) promotionId = hit.conditions.promotionId;
    }

    if (tagId) {
      await this.prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: contact.id, tagId } },
        update: {},
        create: { contactId: contact.id, tagId },
      });
    }

    if (promotionId) {
      const promo = await this.prisma.promotion.findFirst({
        where: { id: promotionId, companyId, isActive: true },
      });
      if (promo) {
        replies.push(
          locale === "en"
            ? `Current promotion: ${promo.name}${promo.description ? ` — ${promo.description}` : ""}`
            : `Promoción vigente: ${promo.name}${promo.description ? ` — ${promo.description}` : ""}`,
        );
      }
    }

    if (hits.some((h) => h.type === "HOURS")) {
      await this.alerts.raise({
        companyId,
        type: "OUTSIDE_HOURS",
        title: "Mensaje fuera de horario",
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
    }

    if (!channel.isActive) {
      await this.alerts.raise({
        companyId,
        type: "NEEDS_REPLY",
        title: `Canal ${channel.name} en pausa`,
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
      return { queuedForHuman: true, conversationId: conversation.id, channelId: channel.id, paused: true };
    }

    const waitingForGuests = priceAsk && guests == null && !transfer;
    if (waitingForGuests) {
      replies.push(
        locale === "en"
          ? "How many people are coming? Then I can tell you the entrance."
          : "¿Para cuántas personas van? Así te digo el valor de la entrada.",
      );
    }

    const keywordOrHoursReply = hits.find(
      (h) =>
        (h.type === "KEYWORD" || h.type === "HOURS" || h.type === "GREETING") &&
        localizedReply(h.actions, locale),
    );

    const cannedHits = locale === "en" ? [] : await this.replies.match(companyId, params.text);
    if (!waitingForGuests && !keywordOrHoursReply && !askApp && cannedHits[0] && !transfer) {
      replies.push(cannedHits[0].body);
    }

    const replyMode: ReplyMode = flow?.replyMode ?? params.company.replyMode ?? "AUTO";
    if (replyMode === "MANUAL" && !keywordOrHoursReply && !askApp && !transfer) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { humanTakeover: true, status: "HUMAN" },
      });
      await this.alerts.raise({
        companyId,
        type: "NEEDS_REPLY",
        title: "Responder manualmente",
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
      return { queuedForHuman: true, conversationId: conversation.id, mode: "MANUAL", channelId: channel.id };
    }

    const wantPhotos = asksForPhotos(params.text);
    const serviceLook =
      !isGreetingOnly(params.text) &&
      !isPriceQuestion(params.text) &&
      !looksLikeBooking(params.text) &&
      !wantsStayReservation(params.text) &&
      !asksForLocation(params.text) &&
      !asksForHours(params.text) &&
      !asksForAvailability(params.text);
    const photoHint = [params.text, ...recent.filter((m) => m.direction === "INBOUND").map((m) => m.content)].join("\n");
    const visual =
      wantPhotos || serviceLook
        ? await this.chooseCatalogPhoto(companyId, conversation.id, photoHint, params.text)
        : null;
    const photos = visual ? [visual] : [];
    const photoQuestionOnly =
      wantPhotos &&
      !isPriceQuestion(params.text) &&
      !looksLikeBooking(params.text) &&
      !wantsStayReservation(params.text) &&
      !asksForLocation(params.text) &&
      !asksForHours(params.text);

    if (wantPhotos && !visual) {
      replies.push(
        locale === "en"
          ? "I don't have photos loaded yet. I'll have someone from the team send them."
          : "Aún no tengo fotos cargadas. Te las mando con alguien del equipo.",
      );
    }

    const availabilityAsk = asksForAvailability(params.text);
    const availabilityFact =
      availabilityAsk && !photoQuestionOnly
        ? await this.availabilityReply(companyId, conversation.id, params.text, params.company.timezone, locale)
        : null;

    const offerDeposit = !availabilityAsk && shouldOfferDeposit(params.text, params.company.timezone);
    if (offerDeposit && !photoQuestionOnly) {
      const hinted = parseBookingDateHint(params.text, params.company.timezone);
      const resource = hinted ? await this.resourceRoom(companyId, hinted, params.text) : null;
      if (resource?.placeName && !resource.hasRoom) {
        replies.push(
          formatAvailabilityReply(locale, {
            date: hinted!,
            isToday: hinted === dateInZone(new Date(), params.company.timezone),
            hasRoom: false,
            placeName: resource.placeName,
          }),
        );
      } else {
        const booking = await this.bookings.botContext(companyId);
        const methods = await this.payments.listActive(companyId);
        const deposit = formatDepositHoldReply(
          locale,
          params.text,
          booking?.depositPercent ?? 50,
          methods,
        );
        if (deposit) replies.push(deposit);
      }
    }

    const hasFixedReply = Boolean(keywordOrHoursReply || cannedHits[0]);
    if (
      !(photoQuestionOnly && !visual) &&
      !offerDeposit &&
      !transfer &&
      !waitingForGuests &&
      (availabilityFact || askApp || !hasFixedReply || (awaitingGuests && guests != null))
    ) {
      try {
        const generated = await this.generateReply({
          companyId,
          companyName: params.company.name,
          systemPrompt: flow?.systemPrompt ?? params.company.botSystemPrompt,
          tone: flow?.tone ?? params.company.botTone,
          conversationId: conversation.id,
          userText: params.text,
          alreadyReplied,
          guestCount: guests,
          photoContext: visual
            ? { detail: visual.detail, onlyOne: visual.onlyOne }
            : undefined,
          availabilityFact,
        });
        if (generated) replies.push(generated);
        else if (availabilityFact) replies.push(availabilityFact);
        else {
          const fallback = hits.find((h) => h.type === "FALLBACK" && h.actions.reply);
          replies.push(localizedReply(fallback?.actions, locale) ?? keepConversationGoing(locale, params.text));
          await this.alerts.raise({
            companyId,
            type: "BOT_FALLBACK",
            title: "El bot no encontró una respuesta precisa",
            body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
            conversationId: conversation.id,
          });
        }
      } catch (err) {
        this.logger.error(`generateReply falló: ${(err as Error).message}`);
        replies.push(availabilityFact ?? keepConversationGoing(locale, params.text));
      }
    }

    if (transfer) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { humanTakeover: true, status: "HUMAN" },
      });
      const groupHit = hits.find((h) => h.conditions.minGuests);
      await this.alerts.raise({
        companyId,
        type: "HUMAN_TAKEOVER",
        title: groupHit
          ? `Grupo de ${groupHit.conditions.minGuests}+ personas: atender en WhatsApp`
          : "Cliente pidió un asesor",
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
      if (!replies.length && !groupHit) {
        replies.push(
          locale === "en"
            ? "I'll connect you with someone from the team."
            : "Te estamos conectando con un asesor.",
        );
      }
    }

    const uniqueReplies = [...new Set(replies.filter(Boolean))];
    if (!uniqueReplies.length && !transfer && !photos.length) {
      uniqueReplies.push(keepConversationGoing(locale, params.text));
    }
    if (replyMode === "HYBRID") {
      await this.alerts.raise({
        companyId,
        type: "NEEDS_REPLY",
        title: "Revisar respuesta del bot",
        body: `${contact.name || contact.phone}: ${params.text.slice(0, 140)}`,
        conversationId: conversation.id,
      });
    }
    for (const text of uniqueReplies) {
      await this.sendAndStore({
        conversationId: conversation.id,
        accountId: params.account?.id,
        to: params.from,
        text,
      });
    }
    for (const photo of photos.slice(0, 1)) {
      const delivered = await this.sendAndStoreImage({
        conversationId: conversation.id,
        accountId: params.account?.id,
        to: params.from,
        url: photo.url,
        filePath: photo.filePath,
      });
      if (!delivered) {
        this.logger.error("La foto no se pudo enviar");
      }
    }

    return {
      ok: true,
      conversationId: conversation.id,
      channelId: channel.id,
      flowId: flow?.id,
      replies: uniqueReplies,
      photos: photos.length,
    };
  }

  async sendAndStore(params: {
    conversationId: string;
    accountId?: string;
    to: string;
    text: string;
  }) {
    const account = params.accountId
      ? await this.prisma.whatsAppAccount.findUnique({ where: { id: params.accountId } })
      : null;
    const token = account ? this.crypto.decryptOrNull(account.accessTokenEnc) : null;
    let providerMessageId: string | undefined;
    if (token && account) {
      try {
        const channel = this.adapter.resolve(account.provider);
        const sent = await channel.sendText({
          accessToken: token,
          phoneNumberId: account.phoneNumberId,
          to: params.to,
          text: params.text,
        });
        providerMessageId = sent.providerMessageId;
      } catch (err) {
        this.logger.error(`Envío WhatsApp falló: ${(err as Error).message}`);
      }
    }
    await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: "OUTBOUND",
        type: "text",
        content: params.text,
        providerMessageId,
      },
    });
    await this.prisma.conversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  private async sendAndStoreImage(params: {
    conversationId: string;
    accountId?: string;
    to: string;
    url: string;
    filePath?: string;
    caption?: string;
  }) {
    const account = params.accountId
      ? await this.prisma.whatsAppAccount.findUnique({ where: { id: params.accountId } })
      : null;
    const token = account ? this.crypto.decryptOrNull(account.accessTokenEnc) : null;
    let providerMessageId: string | undefined;
    if (token && account) {
      try {
        const channel = this.adapter.resolve(account.provider);
        if (channel.sendImage) {
          const sent = await channel.sendImage({
            accessToken: token,
            phoneNumberId: account.phoneNumberId,
            to: params.to,
            imageUrl: params.filePath ? undefined : params.url,
            filePath: params.filePath,
            caption: params.caption,
          });
          providerMessageId = sent.providerMessageId;
        }
      } catch (err) {
        this.logger.error(`Envío de foto falló: ${(err as Error).message}`);
      }
    }
    const delivered = Boolean(providerMessageId);
    await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: "OUTBOUND",
        type: "image",
        content: params.caption ? `${params.caption}\n${params.url}` : params.url,
        providerMessageId,
      },
    });
    await this.prisma.conversation.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    });
    return delivered;
  }

  private async chooseCatalogPhoto(companyId: string, conversationId: string, hint: string, currentText: string) {
    const skip = new Set([
      "foto",
      "fotos",
      "imagen",
      "imagenes",
      "photo",
      "photos",
      "picture",
      "pictures",
      "instalaciones",
      "instalacion",
      "lugar",
      "tiene",
      "tienen",
      "manda",
      "mandame",
      "envia",
      "enviame",
      "para",
      "del",
      "una",
      "unas",
      "los",
      "las",
      "con",
    ]);
    const usable = (text: string, max: number) => searchTokens(text, max).filter((word) => !skip.has(word));
    const wantPhotos = asksForPhotos(currentText);
    const tokens = wantPhotos ? usable(hint, 24) : usable(currentText, 12);
    if (!tokens.length && !wantPhotos) return null;

    const [services, products, sent] = await Promise.all([
      this.prisma.service.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, description: true, imageUrls: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, isActive: true },
        select: {
          name: true,
          description: true,
          imageUrls: true,
          parentService: { select: { id: true, name: true, description: true } },
        },
      }),
      this.prisma.message.findMany({
        where: { conversationId, direction: "OUTBOUND", type: "image" },
        select: { content: true },
        orderBy: { createdAt: "asc" },
        take: 30,
      }),
    ]);

    const foldText = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const hit = (text: string) => {
      const hay = foldText(text);
      return tokens.some((token) => hay.includes(token));
    };
    type Choice = { detail: string; urls: string[]; needle: string };
    const choices: Choice[] = [];
    for (const service of services) {
      if (!tokens.length || !hit(`${service.name} ${service.description ?? ""}`)) continue;
      const children = products.filter((product) => product.parentService?.id === service.id && product.imageUrls.length);
      const urls = [...service.imageUrls, ...children.flatMap((product) => product.imageUrls)];
      const extra = children
        .map((product) => [product.name, product.description].filter(Boolean).join(": "))
        .join("\n");
      const detail = [service.name, service.description, extra].filter(Boolean).join("\n");
      if (urls.length) choices.push({ detail, urls, needle: foldText(service.name) });
    }
    if (!choices.length && tokens.length) {
      for (const product of products) {
        const parent = product.parentService;
        const blob = `${product.name} ${product.description ?? ""} ${parent?.name ?? ""}`;
        if ((tokens.length && !hit(blob)) || !product.imageUrls.length) continue;
        const detail = [parent?.name, parent?.description, product.name, product.description].filter(Boolean).join("\n");
        choices.push({ detail, urls: product.imageUrls, needle: foldText(parent?.name || product.name) });
      }
    }
    if (!tokens.length && !choices.length && wantPhotos) {
      const any = [...services.flatMap((service) => service.imageUrls), ...products.flatMap((product) => product.imageUrls)];
      const named = services.find((service) => service.imageUrls.length) ?? null;
      const product = products.find((item) => item.imageUrls.length) ?? null;
      const urls = named?.imageUrls.length ? named.imageUrls : product?.imageUrls ?? any;
      const detail = [named?.name ?? product?.name, named?.description ?? product?.description].filter(Boolean).join("\n");
      if (urls.length && detail) choices.push({ detail, urls, needle: "" });
    }
    const foldedHint = foldText(hint);
    const choice = choices.reduce<Choice | undefined>((best, item) => {
      if (!best) return item;
      return foldedHint.lastIndexOf(item.needle) >= foldedHint.lastIndexOf(best.needle) ? item : best;
    }, undefined);
    if (!choice) return null;
    const resolved = choice.urls
      .map((url) => this.resolvePhoto(url))
      .filter((photo): photo is { url: string; filePath?: string } => Boolean(photo));
    if (!resolved.length) return null;

    const sentBlob = sent.map((message) => message.content).join("\n");
    const fresh = resolved.find((photo) => !sentBlob.includes(photo.url));
    const already = resolved.some((photo) => sentBlob.includes(photo.url));
    const askingMore = /\b(otra|mas fotos|más fotos|otra foto|mas foto|más foto|siguientes)\b/i.test(currentText);
    const again = askingMore || (wantPhotos && already);
    const picked = again ? (fresh ?? resolved[0]) : resolved[0];
    const onlyOne = again && !fresh;
    return { url: picked.url, filePath: picked.filePath, detail: choice.detail, onlyOne };
  }

  private resolvePhoto(url: string): { url: string; filePath?: string } | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1|::1/i.test(url)) {
      return { url };
    }
    const rel = url.replace(/^\/+/, "");
    const candidates = [join(process.cwd(), rel), join(process.cwd(), "uploads", rel.replace(/^uploads[\\/]/, ""))];
    const filePath = candidates.find((p) => existsSync(p));
    if (!filePath) return /^https?:\/\//i.test(url) ? { url } : null;
    return { url, filePath };
  }

  private async generateReply(params: {
    companyId: string;
    companyName: string;
    systemPrompt?: string | null;
    tone?: string | null;
    conversationId: string;
    userText: string;
    alreadyReplied?: boolean;
    guestCount?: number | null;
    photoContext?: { detail: string; onlyOne: boolean };
    availabilityFact?: string | null;
  }): Promise<string | null> {
    const plan = classifyIntent(params.userText);
    if (params.guestCount != null) {
      plan.needsCatalog = true;
      if (!plan.sources.includes("CATALOG")) plan.sources = ["CATALOG", ...plan.sources];
      plan.chunkLimit = Math.max(plan.chunkLimit, 6);
    }
    const history = await this.prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: "desc" },
      take: plan.intent === "greeting" ? 4 : 8,
    });
    const chronological = history.reverse();
    const transcript = chronological
      .map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Empresa"}: ${m.content}`)
      .join("\n");

    const company = await this.prisma.company.findUnique({
      where: { id: params.companyId },
      select: { timezone: true, name: true, mapUrl: true },
    });

    const locale = detectReplyLocale(params.userText);
    if (plan.needsMap || plan.needsHours) {
      const parts: string[] = [];
      if (plan.needsMap) {
        parts.push(formatLocationReply(locale, company?.name ?? params.companyName, company?.mapUrl));
      }
      if (plan.needsHours) {
        const booking = await this.bookings.botContext(params.companyId);
        parts.push(formatHoursReply(locale, booking?.hours ?? []));
      }
      return parts.join("\n\n");
    }

    const retrieved = plan.chunkLimit
      ? await this.knowledge.retrieve(params.companyId, params.userText, {
          limit: plan.chunkLimit,
          sourceTypes: plan.sources,
        })
      : [];

    const catalogLines = plan.needsCatalog
      ? await this.relevantCatalog(params.companyId, params.userText, plan.needsPromo)
      : "";

    const tz = company?.timezone ?? "America/Lima";
    let bookingLines = "";
    if (plan.needsBooking) {
      const booking = await this.bookings.botContext(params.companyId);
      const slotLines = booking ? await this.bookingSlotLines(params.companyId, params.userText, tz) : "";
      bookingLines = booking
        ? [
            `Reservas activas (${booking.title}).`,
            booking.allowBotBooking
              ? `Si el cliente quiere reservar, pide qué reserva y para qué día. La reserva se asegura con un abono del ${booking.depositPercent}%. No confirmes que ya está reservado ni que ya pagó.`
              : "Puedes informar horarios y qué se reserva, pero no confirmes citas: un asesor las registra en el panel.",
            `Horario: ${booking.hours.join("; ")}`,
            `Tope interno del día: no lo menciones al cliente. Solo di si hay lugar o si el día está ocupado.`,
            booking.items.services.length ? `Servicios reservables: ${booking.items.services.join(", ")}` : "",
            booking.items.products.length ? `Productos reservables: ${booking.items.products.join(", ")}` : "",
            booking.items.addons.length
              ? `Complementos (no se ofrecen sueltos; solo con su servicio y con stock limitado): ${booking.items.addons.join("; ")}`
              : "",
            booking.confirmationMessage ? `Mensaje de confirmación: ${booking.confirmationMessage}` : "",
            booking.cancelPolicy ? `Cancelación: ${booking.cancelPolicy}` : "",
            booking.closedDates?.length
              ? `Días cerrados a visitas (no ofrezcas reserva esos días): ${booking.closedDates.join(", ")}`
              : "",
            slotLines,
          ]
            .filter(Boolean)
            .join("\n")
        : "El módulo de reservas no está activo para esta empresa. No ofrezcas citas ni turnos.";
    }

    let paymentLines = "";
    if (plan.needsPayment) {
      const methods = await this.payments.listActive(params.companyId);
      paymentLines = methods.length
        ? [
            "Métodos de pago ACTIVOS. Para reservar, el cliente transfiere el adelanto a UNA de estas cuentas y envía la captura. Comparte SOLO estos. No inventes cuentas ni links. No confirmes el pago.",
            ...methods.map((method) => {
              if (method.type === "TRANSFER") {
                return [
                  `- Transferencia (${method.name})`,
                  method.bank ? `banco ${method.bank}` : "",
                  method.accountType ? method.accountType : "",
                  method.accountNumber ? `cuenta ${method.accountNumber}` : "",
                  method.accountHolder ? `a nombre de ${method.accountHolder}` : "",
                  method.notes ?? "",
                ]
                  .filter(Boolean)
                  .join(" · ");
              }
              return [
                `- Pago con tarjeta (${method.name})`,
                method.paymentUrl ? `link: ${method.paymentUrl}` : "",
                method.notes ?? "",
              ]
                .filter(Boolean)
                .join(" · ");
            }),
          ].join("\n")
        : "No hay métodos de pago activos. No menciones cuentas bancarias, transferencias, links de pago ni tarjetas. Si preguntan cómo pagar, di que un asesor les indica la forma.";
    }

    const offerings =
      plan.needsCatalog || plan.intent === "service" || plan.intent === "product"
        ? await this.companyOfferings(params.companyId, {
            includeProducts: plan.needsCatalog,
            namesOnly: !isPriceQuestion(params.userText),
          })
        : "";
    const alreadyReplied = params.alreadyReplied ?? chronological.some((m) => m.direction === "OUTBOUND");
    const contextBlocks = [
      offerings ? `Qué ofrece esta empresa:\n${offerings}` : "",
      retrieved.length ? `Conocimiento (${plan.intent}):\n${retrieved.join("\n---\n")}` : "",
      catalogLines ? `Catálogo relevante:\n${catalogLines}` : "",
      bookingLines ? `Reservas:\n${bookingLines}` : "",
      paymentLines ? `Pagos:\n${paymentLines}` : "",
    ].filter(Boolean);

    const system = [
      `Eres quien atiende WhatsApp de ${company?.name ?? params.companyName}, enfocado en cabañas y estadía (glamping, acampar). Hablas como una persona del lugar, no como un bot ni un formulario.`,
      `Zona horaria del negocio: ${company?.timezone ?? "America/Lima"}.`,
      params.tone ? `Tono: ${params.tone}.` : "Tono: cálido y cercano.",
      "Escribe como una persona del lugar, por WhatsApp: corto, cálido y natural. Nada de frases de formulario ni la misma fórmula en cada mensaje.",
      params.systemPrompt ?? "",
      `Intención detectada: ${plan.intent}. Usa SOLO el contexto de abajo. No inventes precios, stock, horarios ni promociones.`,
      alreadyReplied
        ? "Ya saludaste en este chat. No digas Hola, no te presentes otra vez, no agradezcas el interés. Sigue la conversación en una o dos frases."
        : plan.intent === "greeting"
          ? "Saluda una sola vez, corto y humano. No te presentes como asistente. No listes actividades, precios, mapa ni horario. Pregunta qué quieren hacer."
          : "Si aún no saludaste, un saludo corto basta. No te presentes como asistente.",
      "Un tema por mensaje. No envíes folleto: mapa, horario o precios solo si el cliente lo pidió en este mensaje.",
      "Las personas son cuántos van. Los recursos (glamping, botes, mesas) son las unidades creadas en la agenda. Si preguntan disponibilidad, di solo si ese recurso está libre u ocupado. Nunca digas cuántas unidades hay ni cuántas personas caben.",
      params.guestCount != null
        ? `Van ${params.guestCount} personas. Ya puedes decir el precio de la entrada. No preguntes otra vez cuántos son. Si no dijeron edades, da las tarifas y pregunta si van niños.`
        : "Si preguntan precio o entrada y no dijeron cuántas personas, NO des precios: pregunta para cuántos van. Grupos de 12 o más los atiende una persona del equipo.",
      "No pidas nombre ni teléfono: ya los tienes por WhatsApp. No pidas una lista de datos. Una sola pregunta por mensaje.",
      "Nunca dejes el chat en silencio. Si dicen ok, gracias o me avisas, sigue el hilo: siguiente paso o estado de la reserva.",
      "Si ya dijeron personas, fecha u ocasión, no te quedes en 'claro, te ayudamos'. Di cómo reservar: qué quieren, el día y que se asegura con un abono. No confirmes que ya está reservado: eso lo confirma una persona del equipo.",
      "Si preguntan si ya quedaron reservados, dilo con claridad: aún no está confirmado hasta que un asesor valide. Ofrece el siguiente paso.",
      "Si preguntan cómo reservar o piden glamping: pregunta el día y cuántas personas van. Di que la reserva se asegura con un abono. No inventes cuentas: los datos de transferencia se envían aparte.",
      "Si preguntan qué hay, nombra las experiencias en una o dos líneas. Sin mapa, horario ni precios.",
      "Si preguntan fotos y no hay imágenes cargadas, di solo que aún no están cargadas. No digas que tienes fotos ni que las vas a enviar.",
      params.availabilityFact
        ? [
            "El cliente pregunta si hay lugar. Este dato es solo para ti; dilo con calidez, en una o dos frases, y nombra ese recurso.",
            "Aunque pregunten cuántos hay, no des el número. Di solo si está libre u ocupado.",
            "No ofrezcas el abono ni la cuenta. No hables de otro recurso.",
            `Dato de agenda: ${params.availabilityFact}`,
          ].join("\n")
        : "",
      isWebBookingLead(params.userText)
        ? [
            "El cliente armó este pedido en la página web y lo mandó por WhatsApp.",
            "Confirma con calidez que recibiste el pedido: experiencia, fecha, personas y horario si vienen en el mensaje.",
            "No pidas otra vez qué quiere hacer. Pregunta si lo apartamos o si quiere cambiar algo. No envíes el abono ni la cuenta todavía.",
          ].join("\n")
        : "",
      params.photoContext
        ? [
            "En este turno se envía una foto aparte, sin texto en la imagen. Tú escribes la respuesta.",
            "La ficha de abajo es solo para ti: úsala y contesta con tus palabras. No la copies ni la pegues.",
            params.photoContext.onlyOne ? "No hay otra foto. Di que es la única de momento." : "",
            `Ficha interna:\n${params.photoContext.detail}`,
          ]
            .filter(Boolean)
            .join("\n")
        : "",
      "Si no está en el contexto, dilo con claridad y ofrece pasar con alguien del equipo.",
      locale === "en"
        ? "Reply in English, briefly (max 350 characters). Translate catalog facts into English. Do not answer in Spanish. Sound like a person, not a chatbot."
        : "Responde en español, breve (máx. 350 caracteres). Suena como una persona, no como un chatbot.",
      ...contextBlocks,
    ]
      .filter(Boolean)
      .join("\n");

    const generated = await this.llm.chat(
      params.companyId,
      system,
      `Historial:\n${transcript}\n\nÚltimo mensaje del cliente:\n${params.userText}`,
    );
    if (generated) return generated.slice(0, 1000);

    if (plan.intent === "greeting") {
      return locale === "en"
        ? "Hi 🌿 Welcome to Ayllu, by the lake. What would you like to do?"
        : "¡Hola! 🌿 Bienvenido a Ayllu. Un espacio junto al lago para disfrutar, descansar y crear momentos especiales. ¿Cómo podemos ayudarte hoy?";
    }

    return this.keywordFallback(params.userText, catalogLines, retrieved);
  }

  private async relevantCatalog(companyId: string, userText: string, includePromo: boolean) {
    const tokens = searchTokens(userText);
    const now = new Date();
    const nameOrDesc = tokens.flatMap((w) => [
      { name: { contains: w, mode: "insensitive" as const } },
      { description: { contains: w, mode: "insensitive" as const } },
    ]);
    const tokenOr = nameOrDesc.length ? { OR: nameOrDesc } : {};

    const wantAddons = mentionsCatalogAddon(userText);
    const [products, services, promotions] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          companyId,
          isActive: true,
          ...(wantAddons ? {} : { isAddon: false }),
          ...(nameOrDesc.length
            ? {
                OR: [
                  ...tokens.map((w) => ({ sku: { contains: w, mode: "insensitive" as const } })),
                  ...nameOrDesc,
                ],
              }
            : {}),
        },
        include: { prices: true, category: true, parentService: { select: { name: true } } },
        take: 8,
      }),
      this.prisma.service.findMany({
        where: { companyId, isActive: true, ...tokenOr },
        include: { prices: true, category: true },
        take: 8,
      }),
      includePromo
        ? this.prisma.promotion.findMany({
            where: {
              companyId,
              isActive: true,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
              ],
            },
            take: 6,
          })
        : Promise.resolve([]),
    ]);

    const items = tokens.length
      ? { products, services }
      : { products: products.slice(0, 4), services: services.slice(0, 4) };

    return [
      ...items.products.map((p) => {
        const links = Array.isArray(p.links)
          ? (p.links as Array<{ label?: string; url?: string }>)
              .filter((l) => l?.url)
              .map((l) => `${l.label ?? "link"} ${l.url}`)
              .join("; ")
          : "";
        const kind = p.isAddon
          ? `Complemento ${p.name} (solo con ${p.parentService?.name ?? "su servicio"}${
              p.stock != null ? `, stock ${p.stock}` : ""
            }; no se ofrece suelto)`
          : `Producto ${p.name}`;
        return `- ${kind}${p.sku ? ` (SKU ${p.sku})` : ""}${
          p.category?.name ? ` [${p.category.name}]` : ""
        }: ${p.description ?? ""} | precios: ${
          p.prices.map((pr) => `${pr.label} ${moneyLabel(pr.amount, pr.currency)}`).join(", ") || "sin precio"
        }${p.imageUrls?.length ? ` | fotos: ${p.imageUrls.join(" ")}` : ""}${
          links ? ` | enlaces: ${links}` : ""
        }`;
      }),
      ...items.services.map(
        (s) =>
          `- Servicio ${s.name}${s.category?.name ? ` [${s.category.name}]` : ""}${
            s.durationMinutes ? ` (${s.durationMinutes} min)` : ""
          }: ${s.description ?? ""} | precios: ${s.prices
            .map((pr) => `${pr.label} ${moneyLabel(pr.amount, pr.currency)}`)
            .join(", ") || "sin precio"}`,
      ),
      ...promotions.map(
        (p) =>
          `- Promoción ${p.name}${p.code ? ` (código ${p.code})` : ""}: ${p.description ?? ""}${
            p.imageUrls?.length ? ` | fotos: ${p.imageUrls.join(" ")}` : ""
          }`,
      ),
    ].join("\n");
  }

  private async availabilityReply(
    companyId: string,
    conversationId: string,
    userText: string,
    timezone: string,
    locale: "es" | "en",
  ): Promise<string> {
    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { direction: true, content: true },
    });
    const fromCustomer = [userText, ...history.filter((m) => m.direction === "INBOUND").map((m) => m.content)].join("\n");
    const date =
      parseBookingDateHint(userText, timezone) ??
      parseBookingDateHint(fromCustomer, timezone) ??
      dateInZone(new Date(), timezone);
    const room = await this.resourceRoom(companyId, date, fromCustomer, userText);
    if (!room) {
      return locale === "en"
        ? "I can't see the resources from here. Someone from the team will confirm. Nothing is booked yet."
        : "Desde aquí no veo los recursos de la agenda. Alguien del equipo te confirma. Todavía no hay reserva.";
    }
    return formatAvailabilityReply(locale, {
      date,
      isToday: date === dateInZone(new Date(), timezone),
      hasRoom: room.hasRoom,
      placeName: room.placeName,
      resourceNames: room.names,
    });
  }

  private async resourceRoom(companyId: string, date: string, hint: string, currentText?: string) {
    const day = await this.bookings.dayResources(companyId, date);
    if (!day) return null;
    const place =
      (currentText ? matchBookingPlace(day.places, currentText) : null) ?? matchBookingPlace(day.places, hint);
    if (!place) {
      return { placeName: null as string | null, hasRoom: false, names: day.places.map((item) => item.name) };
    }
    const occupied = day.occupied.filter((blob) => bookingUsesPlace(place, blob)).length;
    return {
      placeName: place.name,
      hasRoom: occupied < place.unitCount,
      names: day.places.map((item) => item.name),
    };
  }

  private async bookingSlotLines(companyId: string, userText: string, timezone: string): Promise<string> {
    if (!looksLikeBooking(userText)) return "";
    const hinted = parseBookingDateHint(userText, timezone);
    const start = hinted ?? dateInZone(new Date(), timezone);
    const dates = hinted ? [hinted] : [start, addDays(start, 1), addDays(start, 2)];
    const blocks: string[] = [];
    for (const date of dates) {
      try {
        const pack = await this.bookings.slots(companyId, date);
        const times = pack.slots.slice(0, 8).map((s) =>
          new Intl.DateTimeFormat("es-PE", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date(s.start)),
        );
        blocks.push(
          times.length
            ? `${date}: hay lugar`
            : `${date}: ocupado`,
        );
      } catch (err) {
        this.logger.warn(`No se pudieron leer cupos de ${date}: ${(err as Error).message}`);
      }
    }
    return blocks.length ? `Cupos reales (no inventes otros):\n${blocks.join("\n")}` : "";
  }

  private async companyOfferings(companyId: string, opts?: { includeProducts?: boolean; namesOnly?: boolean }) {
    const includeProducts = opts?.includeProducts !== false;
    const namesOnly = opts?.namesOnly === true;
    const [services, products] = await Promise.all([
      this.prisma.service.findMany({
        where: { companyId, isActive: true },
        select: { name: true, description: true },
        orderBy: { name: "asc" },
        take: 12,
      }),
      includeProducts
        ? this.prisma.product.findMany({
            where: { companyId, isActive: true, isAddon: false },
            select: { name: true, description: true },
            orderBy: { name: "asc" },
            take: 8,
          })
        : Promise.resolve([]),
    ]);
    if (namesOnly) {
      return [...services.map((s) => s.name), ...products.map((p) => p.name)].filter(Boolean).join(", ");
    }
    const lines = [
      ...services.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`),
      ...products.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`),
    ];
    return lines.join("\n");
  }

  private keywordFallback(userText: string, catalog: string, retrieved: string[]): string | null {
    const q = userText.toLowerCase();
    const lines = [...catalog.split("\n"), ...retrieved];
    const hits = lines.filter((l) =>
      q
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((w) => l.toLowerCase().includes(w)),
    );
    if (!hits.length) return null;
    const prefix = detectReplyLocale(userText) === "en" ? "From our catalog:" : "Según nuestro catálogo:";
    return `${prefix}\n${hits.slice(0, 4).join("\n")}`;
  }

  private async applyCrmFromChat(params: {
    companyId: string;
    contact: Contact;
    text: string;
    timezone?: string;
  }) {
    const current = params.contact;
    if (current.stage === "WON" || current.stage === "LOST") return current;

    const hint = inferCrmFromMessage(params.text, params.timezone);
    const data: {
      stage?: Contact["stage"];
      nextAction?: string;
      nextActionAt?: Date;
      expectedValue?: number;
    } = {};

    if (hint && crmStageRank(hint.stage) > crmStageRank(current.stage)) {
      data.stage = hint.stage;
      data.nextAction = hint.nextAction;
      if (!current.nextActionAt) {
        data.nextActionAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    } else if (hint && !current.nextAction) {
      data.nextAction = hint.nextAction;
      if (!current.nextActionAt) {
        data.nextActionAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }

    if (current.expectedValue == null) {
      const value = await this.guessExpectedValue(params.companyId, params.text);
      if (value != null) data.expectedValue = value;
    }

    if (!Object.keys(data).length) return current;

    const updated = await this.prisma.contact.update({
      where: { id: current.id },
      data,
    });
    if (data.stage && data.stage !== current.stage) {
      const labels: Record<string, string> = {
        TALKING: "Conversación",
        INTERESTED: "Interesado",
        RESERVED: "Reserva",
      };
      await this.prisma.crmActivity.create({
        data: {
          companyId: params.companyId,
          contactId: current.id,
          type: "STAGE",
          body: `El chat lo pasó a ${labels[data.stage] ?? data.stage}.`,
        },
      });
    }
    return updated;
  }

  private async guessExpectedValue(companyId: string, text: string) {
    const tokens = searchTokens(text, 8);
    if (!tokens.length) return null;
    const [services, products] = await Promise.all([
      this.prisma.service.findMany({
        where: { companyId, isActive: true },
        include: { prices: { where: { isDefault: true }, take: 1 } },
      }),
      this.prisma.product.findMany({
        where: { companyId, isActive: true },
        include: { prices: { where: { isDefault: true }, take: 1 } },
      }),
    ]);
    const foldName = (name: string) =>
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "");
    const hit = [...services, ...products].find((item) => {
      const name = foldName(item.name);
      return tokens.some((token) => name.includes(token) || token.includes(name.split(/\s+/)[0] ?? ""));
    });
    const amount = hit?.prices[0]?.amount;
    const n = amount == null ? NaN : Number(amount);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
