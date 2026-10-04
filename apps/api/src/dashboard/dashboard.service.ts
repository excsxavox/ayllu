import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

const CITA_RE = /cita|agendar|agenda|reserv|horario|turno|disponib/i;
const PROD_RE = /precio|cuesta|producto|servicio|comprar|cat[aá]logo|oferta|promo/i;
const SOP_RE = /problema|ayuda|soporte|reclamo|error|falla|queja|humano|asesor/i;

export type ConversationKind = "consultas" | "productos" | "citas" | "soporte";
export type RecentStatus = "unread" | "pending" | "resolved";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, timezone: true, bookingsEnabled: true, replyMode: true },
    });
    const tz = company?.timezone || "America/Lima";
    const todayStart = startOfZonedDay(tz, 0);
    const yesterdayStart = startOfZonedDay(tz, -1);
    const weekStart = startOfZonedDay(tz, -6);
    const prevWeekStart = startOfZonedDay(tz, -13);
    const prevDayStart = startOfZonedDay(tz, -7);
    const tomorrowStart = startOfZonedDay(tz, 1);

    const [conversations, weekMessages, prevWeekMessages, bookingsToday, bookingsPrevDay, bookingContacts] =
      await Promise.all([
        this.prisma.conversation.findMany({
          where: { companyId },
          include: {
            contact: { select: { name: true, phone: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 8 },
          },
          orderBy: { lastMessageAt: "desc" },
        }),
        this.prisma.message.findMany({
          where: { conversation: { companyId }, createdAt: { gte: weekStart } },
          select: { conversationId: true, createdAt: true, content: true, direction: true },
        }),
        this.prisma.message.findMany({
          where: {
            conversation: { companyId },
            createdAt: { gte: prevWeekStart, lt: weekStart },
          },
          select: { conversationId: true, direction: true },
        }),
        this.prisma.booking.count({
          where: {
            companyId,
            startsAt: { gte: todayStart, lt: tomorrowStart },
            status: { notIn: ["CANCELLED"] },
          },
        }),
        this.prisma.booking.count({
          where: {
            companyId,
            startsAt: { gte: prevDayStart, lt: todayStart },
            status: { notIn: ["CANCELLED"] },
          },
        }),
        this.prisma.booking.findMany({
          where: { companyId, status: { notIn: ["CANCELLED"] } },
          select: { contactId: true },
        }),
      ]);
    const waChannel = await this.prisma.channel.findFirst({
      where: { companyId, type: "WHATSAPP" },
      include: { whatsappAccount: { select: { isActive: true, updatedAt: true, phoneNumberId: true } } },
      orderBy: { updatedAt: "desc" },
    });


    const bookedContacts = new Set(bookingContacts.map((b) => b.contactId).filter(Boolean) as string[]);

    const pendingNow = conversations.filter((c) => statusOf(c) !== "resolved").length;
    const resolvedNow = conversations.length - pendingNow;
    const pendingPrev = conversations.filter((c) => {
      const last = c.messages[0];
      if (!last) return false;
      return last.createdAt < weekStart && last.createdAt >= prevWeekStart && statusOf(c) !== "resolved";
    }).length;
    const resolvedPrev = conversations.filter((c) => {
      const last = c.messages[0];
      if (!last) return false;
      return last.createdAt < weekStart && last.createdAt >= prevWeekStart && statusOf(c) === "resolved";
    }).length;

    const weekConvos = new Set(weekMessages.map((m) => m.conversationId)).size;
    const prevConvos = new Set(prevWeekMessages.map((m) => m.conversationId)).size;
    const botRepliesToday = weekMessages.filter(
      (m) => m.direction === "OUTBOUND" && m.createdAt >= todayStart,
    ).length;
    const botRepliesYesterday = weekMessages.filter(
      (m) => m.direction === "OUTBOUND" && m.createdAt >= yesterdayStart && m.createdAt < todayStart,
    ).length;
    const botRepliesWeek = weekMessages.filter((m) => m.direction === "OUTBOUND").length;
    const botRepliesPrevWeek = prevWeekMessages.filter((m) => m.direction === "OUTBOUND").length;

    const activity = Array.from({ length: 7 }, (_, i) => {
      const start = startOfZonedDay(tz, i - 6);
      const end = startOfZonedDay(tz, i - 5);
      const dayMessages = weekMessages.filter((m) => m.createdAt >= start && m.createdAt < end);
      const ids = new Set(dayMessages.map((m) => m.conversationId));
      return {
        day: ymd(start),
        weekday: WEEKDAYS[weekdayInZone(start, tz)],
        count: ids.size,
        replies: dayMessages.filter((m) => m.direction === "OUTBOUND").length,
      };
    });

    const typeCounts: Record<ConversationKind, number> = {
      consultas: 0,
      productos: 0,
      citas: 0,
      soporte: 0,
    };
    for (const c of conversations) {
      const inbound = c.messages.find((m) => m.direction === "INBOUND");
      typeCounts[classify(inbound?.content ?? "", bookedContacts.has(c.contactId))] += 1;
    }
    const typeTotal = conversations.length || 1;
    const types = (["consultas", "productos", "citas", "soporte"] as const).map((key) => ({
      key,
      label: labelOf(key),
      count: typeCounts[key],
      pct: Math.round((typeCounts[key] / typeTotal) * 100),
    }));

    const recent = conversations.slice(0, 6).map((c) => {
      const last = c.messages[0];
      const state = statusOf(c);
      return {
        id: c.id,
        name: c.contact.name || c.contact.phone,
        phone: c.contact.phone,
        lastMessage: last?.content || "Sin mensajes",
        status: state,
        assigned: c.humanTakeover ? "Asesor" : null,
        at: (last?.createdAt ?? c.lastMessageAt).toISOString(),
      };
    });

    const conversationsToday = new Set(
      weekMessages.filter((m) => m.createdAt >= todayStart).map((m) => m.conversationId),
    ).size;
    const conversationsYesterday = new Set(
      weekMessages
        .filter((m) => m.createdAt >= yesterdayStart && m.createdAt < todayStart)
        .map((m) => m.conversationId),
    ).size;
    const handoverNow = conversations.filter((c) => c.humanTakeover).length;
    const resolvedToday = conversations.filter((c) => {
      const last = c.messages[0];
      return statusOf(c) === "resolved" && last && last.createdAt >= todayStart;
    }).length;
    const now = Date.now();
    const attention = conversations
      .filter((c) => statusOf(c) !== "resolved")
      .map((c) => {
        const lastInbound = c.messages.find((m) => m.direction === "INBOUND");
        const waitFrom = lastInbound?.createdAt ?? c.lastMessageAt;
        return {
          id: c.id,
          name: c.contact.name || c.contact.phone,
          reason: reasonOf(c, lastInbound?.content ?? ""),
          waitMinutes: Math.max(0, Math.round((now - waitFrom.getTime()) / 60000)),
        };
      })
      .sort((a, b) => b.waitMinutes - a.waitMinutes);

    const lastMessageAt = weekMessages.reduce<Date | null>((latest, m) => {
      if (!latest || m.createdAt > latest) return m.createdAt;
      return latest;
    }, null);
    const waAccount = waChannel?.whatsappAccount;
    const whatsappConnected = Boolean(waChannel?.isActive && waAccount?.isActive && waAccount.phoneNumberId);

    return {
      companyName: company?.name ?? "",
      bookingsEnabled: Boolean(company?.bookingsEnabled),
      kpis: {
        conversations: { value: conversations.length, delta: pctDelta(weekConvos, prevConvos) },
        pending: { value: pendingNow, delta: pctDelta(pendingNow, pendingPrev) },
        resolved: { value: resolvedNow, delta: pctDelta(resolvedNow, resolvedPrev) },
        bookingsToday: { value: bookingsToday, delta: pctDelta(bookingsToday, bookingsPrevDay) },
        botReplies: {
          value: botRepliesToday,
          delta: pctDelta(botRepliesToday, botRepliesYesterday),
          week: botRepliesWeek,
          weekDelta: pctDelta(botRepliesWeek, botRepliesPrevWeek),
        },
        conversationsToday,
        conversationsYesterday,
        handover: handoverNow,
        resolvedToday,
      },
      activity,
      types,
      recent,
      attention,
      assistant: {
        replyMode: company?.replyMode ?? "AUTO",
        whatsappConnected,
        lastSyncAt: (lastMessageAt ?? waAccount?.updatedAt ?? waChannel?.updatedAt)?.toISOString() ?? null,
      },
    };
  }
}

function reasonOf(c: { humanTakeover: boolean }, inbound: string) {
  if (c.humanTakeover || /asesor|humano|persona/i.test(inbound)) return "advisor";
  if (/comprobante|transfer|pago|captura|dep[oó]sito/i.test(inbound)) return "proof";
  return "noreply";
}

function statusOf(c: { humanTakeover: boolean; messages: Array<{ direction: string }> }): RecentStatus {
  const last = c.messages[0];
  if (last?.direction === "INBOUND") return "unread";
  if (c.humanTakeover) return "pending";
  return "resolved";
}

function classify(text: string, hasBooking: boolean): ConversationKind {
  if (hasBooking || CITA_RE.test(text)) return "citas";
  if (SOP_RE.test(text)) return "soporte";
  if (PROD_RE.test(text)) return "productos";
  return "consultas";
}

function labelOf(key: ConversationKind) {
  return { consultas: "Consultas", productos: "Productos", citas: "Citas", soporte: "Soporte" }[key];
}

export function pctDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function startOfZonedDay(timeZone: string, offsetDays: number) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const probe = new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
  const hourInTz = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(probe),
  );
  return new Date(Date.UTC(y, m - 1, d + offsetDays, 12 - hourInTz, 0, 0));
}

function weekdayInZone(date: Date, timeZone: string) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? date.getUTCDay();
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}
