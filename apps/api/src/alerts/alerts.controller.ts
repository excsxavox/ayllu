import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { alertSettingsSchema, type AlertType } from "@aylluu/shared";
import { AlertsService } from "./alerts.service";
import { CurrentTenant } from "../auth/decorators";
import { TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query("unread") unread?: string) {
    return this.alerts.list(tenant.companyId, unread === "1");
  }

  @Get("unread-count")
  async unread(@CurrentTenant() tenant: TenantContext) {
    return { count: await this.alerts.unreadCount(tenant.companyId) };
  }

  @Get("settings")
  settings(@CurrentTenant() tenant: TenantContext) {
    return this.alerts.listSettings(tenant.companyId);
  }

  @Put("settings")
  saveSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(alertSettingsSchema)) body: {
      settings: Array<{ type: AlertType; enabled: boolean }>;
    },
  ) {
    return this.alerts.saveSettings(tenant.companyId, body.settings);
  }

  @Post("read-all")
  readAll(@CurrentTenant() tenant: TenantContext) {
    return this.alerts.markAllRead(tenant.companyId);
  }

  @Post("clear")
  clear(@CurrentTenant() tenant: TenantContext) {
    return this.alerts.clearAll(tenant.companyId);
  }

  @Post(":id/read")
  read(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.alerts.markRead(tenant.companyId, id);
  }
}
