import { Body, Controller, Delete, Get, Param, Patch, Post, Query, SetMetadata } from "@nestjs/common";
import {
  bookingSettingsSchema,
  createBookingSchema,
  inviteMemberSchema,
  toggleBookingsSchema,
  updateBookingSchema,
  updateMemberRoleSchema,
} from "@aylluu/shared";
import { BookingsService } from "./bookings.service";
import { AuthService } from "../auth/auth.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { Roles } from "../auth/roles.guard";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Controller()
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @SetMetadata("skipTenant", true)
  @Roles("PLATFORM_ADMIN")
  @Get("admin/companies")
  listCompanies() {
    return this.prisma.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        bookingsEnabled: true,
        setupCompleted: true,
        createdAt: true,
        _count: { select: { memberships: true, bookings: true } },
        memberships: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true, platformRole: true } },
          },
        },
      },
    });
  }

  @SetMetadata("skipTenant", true)
  @Roles("PLATFORM_ADMIN")
  @Post("admin/companies/:id/members")
  addMember(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: unknown,
  ) {
    return this.auth.addCompanyMember(user.id, id, body as never);
  }

  @SetMetadata("skipTenant", true)
  @Roles("PLATFORM_ADMIN")
  @Patch("admin/companies/:id/members/:membershipId")
  updateMember(
    @Param("id") id: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: unknown,
  ) {
    return this.auth.updateCompanyMember(user.id, id, membershipId, body as never);
  }

  @SetMetadata("skipTenant", true)
  @Roles("PLATFORM_ADMIN")
  @Delete("admin/companies/:id/members/:membershipId")
  removeMember(
    @Param("id") id: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auth.removeCompanyMember(user.id, id, membershipId);
  }

  @SetMetadata("skipTenant", true)
  @Roles("PLATFORM_ADMIN")
  @Patch("admin/companies/:id/bookings")
  async toggle(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(toggleBookingsSchema)) body: { bookingsEnabled: boolean },
  ) {
    const company = await this.prisma.company.update({
      where: { id },
      data: { bookingsEnabled: body.bookingsEnabled },
      select: {
        id: true,
        name: true,
        slug: true,
        bookingsEnabled: true,
      },
    });
    await this.audit.log({
      userId: user.id,
      companyId: company.id,
      action: body.bookingsEnabled ? "bookings.enable" : "bookings.disable",
      entity: "Company",
      entityId: company.id,
    });
    return company;
  }

  @Get("bookings/settings")
  settings(@CurrentTenant() tenant: TenantContext) {
    return this.bookings.getSettings(tenant.companyId);
  }

  @Patch("bookings/settings")
  updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(bookingSettingsSchema)) body: unknown,
  ) {
    return this.bookings.updateSettings(tenant.companyId, user.id, body as never);
  }

  @Get("bookings/floor")
  floor(@CurrentTenant() tenant: TenantContext, @Query("date") date: string) {
    return this.bookings.floor(tenant.companyId, date);
  }

  @Get("bookings/slots")
  slots(
    @CurrentTenant() tenant: TenantContext,
    @Query("date") date: string,
    @Query("serviceId") serviceId?: string,
    @Query("productId") productId?: string,
  ) {
    return this.bookings.slots(tenant.companyId, date, serviceId, productId);
  }

  @Get("bookings")
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.bookings.list(tenant.companyId, from, to);
  }

  @Post("bookings")
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBookingSchema)) body: unknown,
  ) {
    return this.bookings.create(tenant.companyId, user.id, body as never);
  }

  @Patch("bookings/:id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBookingSchema)) body: unknown,
  ) {
    return this.bookings.update(tenant.companyId, user.id, id, body as never);
  }

  @Delete("bookings/:id")
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.bookings.remove(tenant.companyId, user.id, id);
  }
}
