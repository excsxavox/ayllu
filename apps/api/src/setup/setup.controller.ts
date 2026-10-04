import { Controller, Get } from "@nestjs/common";
import { SetupService } from "./setup.service";
import { CurrentTenant } from "../auth/decorators";
import { TenantContext } from "../common/types";

@Controller("setup")
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  status(@CurrentTenant() tenant: TenantContext) {
    return this.setup.status(tenant.companyId);
  }
}
