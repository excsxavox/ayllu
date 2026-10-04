import { Injectable } from "@nestjs/common";
import { AlertType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const ALL_ALERT_TYPES: AlertType[] = [
  "NEW_CONVERSATION",
  "HUMAN_TAKEOVER",
  "BOT_FALLBACK",
  "OUTSIDE_HOURS",
  "NEEDS_REPLY",
  "PAYMENT_PROOF",
];

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(companyId: string) {
    await this.prisma.alertSetting.createMany({
      data: ALL_ALERT_TYPES.map((type) => ({ companyId, type, enabled: true })),
      skipDuplicates: true,
    });
  }

  async listSettings(companyId: string) {
    await this.ensureDefaults(companyId);
    return this.prisma.alertSetting.findMany({
      where: { companyId },
      orderBy: { type: "asc" },
    });
  }

  async saveSettings(companyId: string, settings: Array<{ type: AlertType; enabled: boolean }>) {
    await this.ensureDefaults(companyId);
    for (const item of settings) {
      await this.prisma.alertSetting.upsert({
        where: { companyId_type: { companyId, type: item.type } },
        update: { enabled: item.enabled },
        create: { companyId, type: item.type, enabled: item.enabled },
      });
    }
    return this.listSettings(companyId);
  }

  async raise(params: {
    companyId: string;
    type: AlertType;
    title: string;
    body: string;
    conversationId?: string;
  }) {
    await this.ensureDefaults(params.companyId);
    const setting = await this.prisma.alertSetting.findUnique({
      where: { companyId_type: { companyId: params.companyId, type: params.type } },
    });
    if (setting && !setting.enabled) return null;
    return this.prisma.alert.create({
      data: {
        companyId: params.companyId,
        type: params.type,
        title: params.title,
        body: params.body,
        conversationId: params.conversationId ?? null,
      },
    });
  }

  list(companyId: string, unreadOnly = false) {
    return this.prisma.alert.findMany({
      where: { companyId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
  }

  unreadCount(companyId: string) {
    return this.prisma.alert.count({ where: { companyId, readAt: null } });
  }

  async markRead(companyId: string, id: string) {
    const row = await this.prisma.alert.findFirst({ where: { id, companyId } });
    if (!row) return { ok: false };
    await this.prisma.alert.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(companyId: string) {
    await this.prisma.alert.updateMany({
      where: { companyId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async clearAll(companyId: string) {
    const result = await this.prisma.alert.deleteMany({ where: { companyId } });
    return { ok: true, deleted: result.count };
  }
}
