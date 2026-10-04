import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { knowledgeDocumentSchema } from "@aylluu/shared";
import { KnowledgeService } from "./knowledge.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.knowledge.list(tenant.companyId);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(knowledgeDocumentSchema)) body: unknown,
  ) {
    return this.knowledge.create(tenant.companyId, user.id, body as never);
  }

  @Patch(":id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(knowledgeDocumentSchema)) body: unknown,
  ) {
    return this.knowledge.update(tenant.companyId, id, body as never);
  }

  @Delete(":id")
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.knowledge.remove(tenant.companyId, id);
  }

  @Post(":id/reindex")
  reindex(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.knowledge.reindexDocument(tenant.companyId, id);
  }
}
