import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BotFlowInput, ChannelInput, ChannelPatchInput } from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ensureCompanyMessaging } from "./defaults";

const flowInclude = {
  _count: { select: { channels: true, rules: true } },
  channels: { select: { id: true, name: true, type: true }, orderBy: { createdAt: "asc" as const } },
  rules: { select: { id: true, name: true }, orderBy: { priority: "asc" as const } },
} as const;

const channelInclude = {
  flow: { select: { id: true, name: true, isDefault: true, replyMode: true } },
  whatsappAccount: { select: { id: true, displayPhone: true, isActive: true, provider: true } },
  _count: { select: { conversations: true } },
} as const;

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listFlows(companyId: string) {
    await ensureCompanyMessaging(this.prisma, companyId);
    return this.prisma.botFlow.findMany({
      where: { companyId },
      include: flowInclude,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async createFlow(companyId: string, userId: string, input: BotFlowInput) {
    await ensureCompanyMessaging(this.prisma, companyId);
    if (input.isDefault) {
      await this.prisma.botFlow.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.botFlow.create({
      data: {
        companyId,
        name: input.name,
        description: input.description ?? null,
        isDefault: Boolean(input.isDefault),
        systemPrompt: input.systemPrompt ?? null,
        tone: input.tone ?? null,
        replyMode: input.replyMode ?? "AUTO",
      },
      include: flowInclude,
    });
    await this.syncLinks(companyId, row.id, input.channelIds, input.ruleIds);
    await this.audit.log({
      companyId,
      userId,
      action: "flow.create",
      entity: "BotFlow",
      entityId: row.id,
    });
    return this.prisma.botFlow.findUniqueOrThrow({ where: { id: row.id }, include: flowInclude });
  }

  async updateFlow(companyId: string, id: string, userId: string, input: BotFlowInput) {
    const existing = await this.prisma.botFlow.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Flujo no encontrado");
    if (input.isDefault) {
      await this.prisma.botFlow.updateMany({
        where: { companyId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.botFlow.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault ?? existing.isDefault,
        systemPrompt: input.systemPrompt ?? null,
        tone: input.tone ?? null,
        replyMode: input.replyMode ?? existing.replyMode,
      },
      include: flowInclude,
    });
    await this.syncLinks(companyId, id, input.channelIds, input.ruleIds);
    await this.audit.log({
      companyId,
      userId,
      action: "flow.update",
      entity: "BotFlow",
      entityId: row.id,
    });
    return this.prisma.botFlow.findUniqueOrThrow({ where: { id }, include: flowInclude });
  }

  async removeFlow(companyId: string, id: string) {
    const existing = await this.prisma.botFlow.findFirst({
      where: { id, companyId },
      include: { _count: { select: { channels: true } } },
    });
    if (!existing) throw new NotFoundException("Flujo no encontrado");
    if (existing.isDefault) {
      throw new BadRequestException("No puedes borrar el flujo principal. Marca otro como predeterminado primero.");
    }
    const fallback = await this.prisma.botFlow.findFirst({
      where: { companyId, isDefault: true },
    });
    if (existing._count.channels && fallback) {
      await this.prisma.channel.updateMany({
        where: { flowId: id },
        data: { flowId: fallback.id },
      });
    }
    await this.prisma.businessRule.updateMany({
      where: { flowId: id },
      data: { flowId: null },
    });
    await this.prisma.botFlow.delete({ where: { id } });
    return { ok: true };
  }

  private async syncLinks(companyId: string, flowId: string, channelIds?: string[], ruleIds?: string[]) {
    if (channelIds) {
      const valid = await this.prisma.channel.findMany({
        where: { companyId, id: { in: channelIds } },
        select: { id: true },
      });
      const ids = valid.map((row) => row.id);
      if (ids.length) {
        await this.prisma.channel.updateMany({
          where: { companyId, flowId, NOT: { id: { in: ids } } },
          data: { flowId: null },
        });
        await this.prisma.channel.updateMany({
          where: { companyId, id: { in: ids } },
          data: { flowId },
        });
      } else {
        await this.prisma.channel.updateMany({ where: { companyId, flowId }, data: { flowId: null } });
      }
    }
    if (ruleIds) {
      const valid = await this.prisma.businessRule.findMany({
        where: { companyId, id: { in: ruleIds } },
        select: { id: true },
      });
      const ids = valid.map((row) => row.id);
      if (ids.length) {
        await this.prisma.businessRule.updateMany({
          where: { companyId, flowId, NOT: { id: { in: ids } } },
          data: { flowId: null },
        });
        await this.prisma.businessRule.updateMany({
          where: { companyId, id: { in: ids } },
          data: { flowId },
        });
      } else {
        await this.prisma.businessRule.updateMany({ where: { companyId, flowId }, data: { flowId: null } });
      }
    }
  }

  async listChannels(companyId: string) {
    await ensureCompanyMessaging(this.prisma, companyId);
    return this.prisma.channel.findMany({
      where: { companyId },
      include: channelInclude,
      orderBy: { createdAt: "asc" },
    });
  }

  async createChannel(companyId: string, userId: string, input: ChannelInput) {
    await ensureCompanyMessaging(this.prisma, companyId);
    if (input.flowId) {
      const flow = await this.prisma.botFlow.findFirst({ where: { id: input.flowId, companyId } });
      if (!flow) throw new NotFoundException("Flujo no encontrado");
    }
    const row = await this.prisma.channel.create({
      data: {
        companyId,
        type: input.type,
        name: input.name,
        handle: input.handle ?? null,
        isActive: input.isActive ?? true,
        flowId: input.flowId ?? null,
      },
      include: channelInclude,
    });
    await this.audit.log({
      companyId,
      userId,
      action: "channel.create",
      entity: "Channel",
      entityId: row.id,
    });
    return row;
  }

  async updateChannel(companyId: string, id: string, userId: string, input: ChannelPatchInput) {
    const existing = await this.prisma.channel.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Canal no encontrado");
    if (input.flowId) {
      const flow = await this.prisma.botFlow.findFirst({ where: { id: input.flowId, companyId } });
      if (!flow) throw new NotFoundException("Flujo no encontrado");
    }
    const row = await this.prisma.channel.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.handle !== undefined ? { handle: input.handle } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.flowId !== undefined ? { flowId: input.flowId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      },
      include: channelInclude,
    });
    await this.audit.log({
      companyId,
      userId,
      action: "channel.update",
      entity: "Channel",
      entityId: row.id,
    });
    return row;
  }

  async removeChannel(companyId: string, id: string) {
    const existing = await this.prisma.channel.findFirst({
      where: { id, companyId },
      include: { _count: { select: { conversations: true } } },
    });
    if (!existing) throw new NotFoundException("Canal no encontrado");
    if (existing.type === "WHATSAPP" && existing._count.conversations) {
      throw new BadRequestException("No puedes borrar el canal de WhatsApp mientras tenga conversaciones.");
    }
    await this.prisma.channel.delete({ where: { id } });
    return { ok: true };
  }
}
