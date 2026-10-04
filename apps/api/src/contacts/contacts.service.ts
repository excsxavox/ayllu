import { Injectable, NotFoundException } from "@nestjs/common";
import type { ContactAudience, ContactInput, ContactNoteInput, ContactUpdateInput, CrmStage } from "@aylluu/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { assertPhone } from "../common/phone";

const STAGE_LABEL: Record<CrmStage, string> = {
  NEW: "Nuevo",
  TALKING: "En conversación",
  INTERESTED: "Interesado",
  RESERVED: "Reserva",
  WON: "Cerrado",
  LOST: "Perdido",
};

const contactInclude = {
  tags: { include: { tag: true } },
  conversations: {
    orderBy: { lastMessageAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      lastMessageAt: true,
      messages: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { content: true, direction: true, createdAt: true },
      },
    },
  },
  bookings: {
    orderBy: { startsAt: "desc" as const },
    take: 6,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      paymentStatus: true,
      customerName: true,
      service: { select: { name: true } },
      product: { select: { name: true } },
    },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { user: { select: { id: true, name: true } } },
  },
  _count: { select: { conversations: true, bookings: true } },
} satisfies Prisma.ContactInclude;

function parseWhen(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string, audience?: ContactAudience) {
    return this.prisma.contact.findMany({
      where: { companyId, ...(audience ? { audience } : {}) },
      include: contactInclude,
      orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
    });
  }

  async get(companyId: string, id: string) {
    const row = await this.prisma.contact.findUnique({
      where: { id },
      include: contactInclude,
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException("Contacto no encontrado");
    }
    return row;
  }

  async create(companyId: string, userId: string, input: ContactInput) {
    const phone = assertPhone(input.phone);
    const audience = input.audience ?? "CONTACT";
    const stage = input.stage ?? "NEW";
    const source = input.source ?? "MANUAL";
    const row = await this.prisma.contact.upsert({
      where: { companyId_phone: { companyId, phone } },
      create: {
        companyId,
        phone,
        waId: phone,
        name: input.name?.trim() || null,
        email: input.email ?? null,
        audience,
        stage,
        source,
        notes: input.notes?.trim() || null,
        expectedValue: input.expectedValue ?? null,
        nextActionAt: parseWhen(input.nextActionAt),
        nextAction: input.nextAction?.trim() || null,
        lostReason: input.lostReason?.trim() || null,
      },
      update: {
        name: input.name?.trim() || undefined,
        email: input.email === undefined ? undefined : input.email,
        audience,
        stage,
        source,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        expectedValue: input.expectedValue === undefined ? undefined : input.expectedValue,
        nextActionAt: input.nextActionAt === undefined ? undefined : parseWhen(input.nextActionAt),
        nextAction: input.nextAction === undefined ? undefined : input.nextAction?.trim() || null,
        lostReason: input.lostReason === undefined ? undefined : input.lostReason?.trim() || null,
      },
      include: contactInclude,
    });
    await this.audit.log({
      companyId,
      userId,
      action: "contact.upsert",
      entity: "Contact",
      entityId: row.id,
      payload: { phone, audience, stage, source },
    });
    return this.get(companyId, row.id);
  }

  async update(companyId: string, userId: string, id: string, input: ContactUpdateInput) {
    const current = await this.get(companyId, id);
    const nextStage = input.stage;
    const row = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.audience ? { audience: input.audience } : {}),
        ...(nextStage ? { stage: nextStage } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.expectedValue !== undefined ? { expectedValue: input.expectedValue } : {}),
        ...(input.nextActionAt !== undefined ? { nextActionAt: parseWhen(input.nextActionAt) } : {}),
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction?.trim() || null } : {}),
        ...(input.lostReason !== undefined ? { lostReason: input.lostReason?.trim() || null } : {}),
      },
      include: contactInclude,
    });
    if (nextStage && nextStage !== current.stage) {
      await this.logActivity(
        companyId,
        id,
        userId,
        "STAGE",
        `Pasó de ${STAGE_LABEL[current.stage]} a ${STAGE_LABEL[nextStage]}.`,
      );
    }
    const nextAtChanged =
      input.nextActionAt !== undefined &&
      (current.nextActionAt?.toISOString() ?? null) !== (row.nextActionAt?.toISOString() ?? null);
    const nextLabelChanged = input.nextAction !== undefined && (current.nextAction || "") !== (row.nextAction || "");
    if (nextAtChanged || nextLabelChanged) {
      const label = row.nextAction || "Seguimiento";
      const when = row.nextActionAt ? ` (${row.nextActionAt.toISOString().slice(0, 10)})` : "";
      await this.logActivity(companyId, id, userId, "FOLLOW", `${label}${when}`);
    }
    await this.audit.log({
      companyId,
      userId,
      action: "contact.update",
      entity: "Contact",
      entityId: row.id,
      payload: { audience: row.audience, stage: row.stage },
    });
    return this.get(companyId, id);
  }

  async addNote(companyId: string, userId: string, id: string, input: ContactNoteInput) {
    await this.get(companyId, id);
    await this.logActivity(companyId, id, userId, "NOTE", input.body);
    return this.get(companyId, id);
  }

  async addTag(companyId: string, id: string, tagId: string) {
    await this.get(companyId, id);
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, companyId } });
    if (!tag) throw new NotFoundException("Etiqueta no encontrada");
    await this.prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: id, tagId } },
      update: {},
      create: { contactId: id, tagId },
    });
    return this.get(companyId, id);
  }

  async removeTag(companyId: string, id: string, tagId: string) {
    await this.get(companyId, id);
    await this.prisma.contactTag.deleteMany({ where: { contactId: id, tagId } });
    return this.get(companyId, id);
  }

  async remove(companyId: string, userId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.contact.delete({ where: { id } });
    await this.audit.log({
      companyId,
      userId,
      action: "contact.delete",
      entity: "Contact",
      entityId: id,
    });
    return { ok: true };
  }

  private logActivity(
    companyId: string,
    contactId: string,
    userId: string | null,
    type: "NOTE" | "STAGE" | "FOLLOW",
    body: string,
  ) {
    return this.prisma.crmActivity.create({
      data: { companyId, contactId, userId, type, body },
    });
  }
}
