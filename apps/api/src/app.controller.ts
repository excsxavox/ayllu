import { Controller, Get, SetMetadata } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public, CurrentTenant } from "./auth/decorators";
import { TenantContext } from "./common/types";
import { DashboardService } from "./dashboard/dashboard.service";

@Controller()
export class AppController {
  constructor(private readonly dashboards: DashboardService) {}

  @Public()
  @SkipThrottle()
  @Get("health")
  health() {
    return { ok: true, service: "aylluu-api" };
  }

  @SetMetadata("skipTenant", true)
  @Get("health/auth")
  healthAuth() {
    return { ok: true };
  }

  @Get("dashboard")
  dashboard(@CurrentTenant() tenant: TenantContext) {
    return this.dashboards.get(tenant.companyId);
  }
}
