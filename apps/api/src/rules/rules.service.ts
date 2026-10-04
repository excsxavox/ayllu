import { Injectable, NotFoundException } from "@nestjs/common";
import { BusinessRuleInput, RuleActions, RuleConditions } from "@aylluu/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export type RuleHit = {
  ruleId: string;
  type: string;
  actions: RuleActions;
  conditions: RuleConditions;
};

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.businessRule.findMany({
      where: { companyId },
      include: { flow: { select: { id: true, name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(companyId: string, userId: string, input: BusinessRuleInput) {
    const row = await this.prisma.businessRule.create({
      data: {
        companyId,
        name: input.name,
        type: input.type,
        priority: input.priority ?? 100,
        enabled: input.enabled ?? true,
        flowId: input.flowId ?? null,
        conditions: input.conditions as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({
      companyId,
      userId,
      action: "rule.create",
      entity: "BusinessRule",
      entityId: row.id,
    });
    return row;
  }

  async update(companyId: string, id: string, input: BusinessRuleInput) {
    const existing = await this.prisma.businessRule.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Regla no encontrada");
    }
    return this.prisma.businessRule.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        priority: input.priority ?? existing.priority,
        enabled: input.enabled ?? existing.enabled,
        flowId: input.flowId === undefined ? existing.flowId : input.flowId,
        conditions: input.conditions as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.businessRule.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Regla no encontrada");
    }
    await this.prisma.businessRule.delete({ where: { id } });
    return { ok: true };
  }

  parseGuestCount(text: string, opts?: { allowBare?: boolean }): number | null {
    const t = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    const words: Record<string, number> = {
      uno: 1,
      una: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      once: 11,
      doce: 12,
      trece: 13,
      catorce: 14,
      quince: 15,
      dieciseis: 16,
      diecisiete: 17,
      dieciocho: 18,
      diecinueve: 19,
      veinte: 20,
      veintiuno: 21,
      veintidos: 22,
      veintitres: 23,
      veinticuatro: 24,
      veinticinco: 25,
      treinta: 30,
      cuarenta: 40,
      cincuenta: 50,
      sesenta: 60,
      setenta: 70,
      ochenta: 80,
      noventa: 90,
      cien: 100,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      twenty: 20,
    };
    const found: number[] = [];
    for (const match of t.matchAll(
      /(?:somos|vamos|grupo de|para|we are|party of|group of|for)\s+(\d{1,3})|(\d{1,3})\s*(?:personas?|gente|pax|huespedes|integrantes|people|guests?)/g,
    )) {
      const n = Number(match[1] ?? match[2]);
      if (Number.isFinite(n) && n >= 1 && n <= 200) found.push(n);
    }
    for (const [word, n] of Object.entries(words)) {
      if (
        new RegExp(
          `\\b(?:somos|vamos|grupo de|para|we are|party of|group of)\\s+${word}\\b|\\b${word}\\s+(?:personas?|gente|pax|huespedes|integrantes|people|guests?)\\b`,
        ).test(t)
      ) {
        found.push(n);
      }
    }
    const lastLine = t.split(/\n/).pop()?.trim() ?? "";
    const lastBare = lastLine.match(/^(\d{1,3})(?:\s+(?:personas?|gente|pax|people|guests?))?$/);
    if (lastBare && (opts?.allowBare || t.includes("\n"))) {
      const n = Number(lastBare[1]);
      if (n >= 1 && n <= 200) found.push(n);
    }
    if (opts?.allowBare) {
      for (const [word, n] of Object.entries(words)) {
        if (new RegExp(`^${word}$`).test(lastLine)) found.push(n);
      }
    }
    if (!found.length) return null;
    return Math.max(...found);
  }

  isWithinHours(conditions: RuleConditions, timezone: string, now = new Date()): boolean {
    const tz = conditions.timezone || timezone || "America/Lima";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = map[weekday] ?? now.getDay();
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const hhmm = `${hour}:${minute}`;
    if (conditions.days?.length && !conditions.days.includes(day)) return false;
    if (conditions.startTime && hhmm < conditions.startTime) return false;
    if (conditions.endTime && hhmm > conditions.endTime) return false;
    return true;
  }

  async evaluate(params: {
    companyId: string;
    flowId?: string;
    timezone: string;
    text: string;
    isFirstMessage: boolean;
    isGreetingOnly?: boolean;
    alreadyReplied?: boolean;
    humanTakeover: boolean;
    guests?: number | null;
  }): Promise<RuleHit[]> {
    const rules = await this.prisma.businessRule.findMany({
      where: { companyId: params.companyId, enabled: true },
      orderBy: { priority: "asc" },
    });
    const hits: RuleHit[] = [];
    const text = params.text.toLowerCase();

    for (const rule of rules) {
      if (rule.flowId && params.flowId && rule.flowId !== params.flowId) continue;

      const conditions = (rule.conditions ?? {}) as RuleConditions;
      const actions = (rule.actions ?? {}) as RuleActions;

      if (rule.type === "HOURS") {
        const inside = this.isWithinHours(conditions, params.timezone);
        if (conditions.outsideHours ? !inside : inside) {
          hits.push({ ruleId: rule.id, type: rule.type, actions, conditions });
        }
        continue;
      }

      if (rule.type === "GREETING") {
        if (params.alreadyReplied) continue;
        if (conditions.firstMessageOnly === false || params.isFirstMessage || params.isGreetingOnly) {
          hits.push({ ruleId: rule.id, type: rule.type, actions, conditions });
        }
        continue;
      }

      if (rule.type === "KEYWORD") {
        const keywords = (conditions.keywords ?? []).map((k) => k.toLowerCase());
        if (!keywords.length) continue;
        const matched =
          conditions.matchMode === "all"
            ? keywords.every((k) => text.includes(k))
            : keywords.some((k) => text.includes(k));
        if (matched) hits.push({ ruleId: rule.id, type: rule.type, actions, conditions });
        continue;
      }

      if (rule.type === "HANDOVER") {
        const keywords = (conditions.keywords ?? []).map((k) => k.toLowerCase());
        const guests = params.guests !== undefined ? params.guests : this.parseGuestCount(params.text);
        const guestsHit =
          conditions.minGuests != null && guests != null && guests >= conditions.minGuests;
        const keywordHit = keywords.length ? keywords.some((k) => text.includes(k)) : false;
        const openHandover = !keywords.length && conditions.minGuests == null;
        if (guestsHit || keywordHit || openHandover) {
          hits.push({ ruleId: rule.id, type: rule.type, actions, conditions });
        }
        continue;
      }

      if (rule.type === "PROMOTION" || rule.type === "TAG_CONTACT") {
        const keywords = (conditions.keywords ?? []).map((k) => k.toLowerCase());
        if (!keywords.length) continue;
        const matched =
          conditions.matchMode === "all"
            ? keywords.every((k) => text.includes(k))
            : keywords.some((k) => text.includes(k));
        if (matched) hits.push({ ruleId: rule.id, type: rule.type, actions, conditions });
        continue;
      }

      if (rule.type === "FALLBACK") {
        hits.push({ ruleId: rule.id, type: rule.type, actions, conditions });
      }
    }

    return hits;
  }
}
