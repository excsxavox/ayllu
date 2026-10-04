import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { businessRuleSchema } from "@aylluu/shared";
import { RulesService } from "./rules.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("rules")
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.rules.list(tenant.companyId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(businessRuleSchema)) body: unknown,
  ) {
    return this.rules.create(tenant.companyId, user.id, body as never);
  }

  @Patch(":id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(businessRuleSchema)) body: unknown,
  ) {
    return this.rules.update(tenant.companyId, id, body as never);
  }

  @Delete(":id")
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.rules.remove(tenant.companyId, id);
  }
}
