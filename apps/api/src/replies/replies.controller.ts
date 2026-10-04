import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { cannedReplySchema } from "@aylluu/shared";
import { RepliesService } from "./replies.service";
import { CurrentTenant } from "../auth/decorators";
import { TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("replies")
export class RepliesController {
  constructor(private readonly replies: RepliesService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.replies.list(tenant.companyId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(cannedReplySchema)) body: unknown,
  ) {
    return this.replies.create(tenant.companyId, body as never);
  }

  @Patch(":id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cannedReplySchema)) body: unknown,
  ) {
    return this.replies.update(tenant.companyId, id, body as never);
  }

  @Delete(":id")
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.replies.remove(tenant.companyId, id);
  }
}
