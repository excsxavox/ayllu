import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { paymentMethodSchema } from "@aylluu/shared";
import { PaymentsService } from "./payments.service";
import { CurrentTenant } from "../auth/decorators";
import { TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.payments.list(tenant.companyId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(paymentMethodSchema)) body: unknown,
  ) {
    return this.payments.create(tenant.companyId, body as never);
  }

  @Patch(":id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(paymentMethodSchema)) body: unknown,
  ) {
    return this.payments.update(tenant.companyId, id, body as never);
  }

  @Delete(":id")
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.payments.remove(tenant.companyId, id);
  }
}
