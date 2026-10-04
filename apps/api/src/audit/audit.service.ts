import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    companyId?: string | null;
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    payload?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        companyId: params.companyId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        payload: params.payload ?? undefined,
      },
    });
  }
}
