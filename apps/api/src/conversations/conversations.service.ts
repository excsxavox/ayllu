import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BotService } from "../bot/bot.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string, channelId?: string) {
    return this.prisma.conversation.findMany({
      where: { companyId, ...(channelId ? { channelId } : {}) },
      include: {
        contact: { include: { tags: { include: { tag: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        channel: { include: { flow: { select: { id: true, name: true } } } },
      },
      orderBy: { lastMessageAt: "desc" },
    });
  }

  async get(companyId: string, id: string) {
    const row = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: { include: { tags: { include: { tag: true } } } },
        messages: { orderBy: { createdAt: "asc" } },
        channel: { include: { flow: { select: { id: true, name: true, replyMode: true } } } },
      },
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException("Conversación no encontrada");
    }
    return row;
  }

  async takeover(companyId: string, userId: string, id: string, human: boolean) {
    await this.get(companyId, id);
    await this.prisma.conversation.update({
      where: { id },
      data: { humanTakeover: human, status: human ? "HUMAN" : "BOT" },
    });
    await this.audit.log({
      companyId,
      userId,
      action: human ? "conversation.takeover" : "conversation.release",
      entity: "Conversation",
      entityId: id,
    });
    return this.get(companyId, id);
  }

  async sendFromInbox(companyId: string, userId: string, id: string, text: string) {
    const conversation = await this.get(companyId, id);
    if (!conversation.humanTakeover) {
      await this.prisma.conversation.update({
        where: { id },
        data: { humanTakeover: true, status: "HUMAN" },
      });
    }
    await this.bot.sendAndStore({
      conversationId: conversation.id,
      accountId: conversation.whatsappAccountId ?? undefined,
      to: conversation.contact.phone,
      text,
    });
    await this.audit.log({
      companyId,
      userId,
      action: "conversation.reply",
      entity: "Conversation",
      entityId: id,
    });
    return this.get(companyId, id);
  }

  async addContactTag(companyId: string, conversationId: string, tagId: string) {
    const conversation = await this.get(companyId, conversationId);
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, companyId } });
    if (!tag) throw new NotFoundException("Etiqueta no encontrada");
    await this.prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: conversation.contact.id, tagId } },
      update: {},
      create: { contactId: conversation.contact.id, tagId },
    });
    return this.get(companyId, conversationId);
  }

  async removeContactTag(companyId: string, conversationId: string, tagId: string) {
    const conversation = await this.get(companyId, conversationId);
    await this.prisma.contactTag.deleteMany({
      where: { contactId: conversation.contact.id, tagId },
    });
    return this.get(companyId, conversationId);
  }
}
