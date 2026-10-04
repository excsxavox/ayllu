import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentTenant } from "../auth/decorators";
import { Roles } from "../auth/roles.guard";
import { TenantContext } from "../common/types";

@Roles("PLATFORM_ADMIN")
@Controller("audit")
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query("take") take?: string) {
    return this.prisma.auditLog.findMany({
      where: { companyId: tenant.companyId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(take) || 50, 200),
    });
  }
}
