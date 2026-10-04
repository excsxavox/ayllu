import { Injectable, NotFoundException } from "@nestjs/common";
import { CannedReplyInput } from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RepliesService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.cannedReply.findMany({
      where: { companyId },
      orderBy: { title: "asc" },
    });
  }

  create(companyId: string, input: CannedReplyInput) {
    return this.prisma.cannedReply.create({
      data: {
        companyId,
        title: input.title,
        body: input.body,
        shortcut: input.shortcut ?? null,
        keywords: input.keywords ?? [],
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(companyId: string, id: string, input: CannedReplyInput) {
    const existing = await this.prisma.cannedReply.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Respuesta no encontrada");
    }
    return this.prisma.cannedReply.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        shortcut: input.shortcut ?? null,
        keywords: input.keywords ?? [],
        isActive: input.isActive ?? true,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.cannedReply.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Respuesta no encontrada");
    }
    await this.prisma.cannedReply.delete({ where: { id } });
    return { ok: true };
  }

  async match(companyId: string, text: string) {
    const replies = await this.prisma.cannedReply.findMany({
      where: { companyId, isActive: true },
    });
    const q = text.toLowerCase();
    return replies.filter((r) => {
      if (!r.keywords.length) return false;
      return r.keywords.some((k) => q.includes(k.toLowerCase()));
    });
  }
}
