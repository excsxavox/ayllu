import { Body, Controller, ForbiddenException, Get, Param, Patch, SetMetadata } from "@nestjs/common";
import { updateCompanySchema } from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuditService } from "../audit/audit.service";

@Controller("companies")
export class CompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @SetMetadata("skipTenant", true)
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    if (user.platformRole === "PLATFORM_ADMIN") {
      return this.prisma.company.findMany({ orderBy: { name: "asc" } });
    }
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      include: { company: true },
    });
    return memberships.map((m) => m.company);
  }

  @Get("current")
  current(@CurrentTenant() tenant: TenantContext) {
    return this.prisma.company.findUniqueOrThrow({ where: { id: tenant.companyId } });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(updateCompanySchema)) body: {
      name?: string;
      timezone?: string;
      botSystemPrompt?: string | null;
      botTone?: string | null;
      replyMode?: "AUTO" | "HYBRID" | "MANUAL";
      setupCompleted?: boolean;
    },
  ) {
    if (user.platformRole !== "PLATFORM_ADMIN" && id !== tenant.companyId) {
      throw new ForbiddenException("No puedes editar otra empresa");
    }
    const company = await this.prisma.company.update({
      where: { id },
      data: body,
    });
    await this.audit.log({
      userId: user.id,
      companyId: company.id,
      action: "company.update",
      entity: "Company",
      entityId: company.id,
    });
    return company;
  }
}
