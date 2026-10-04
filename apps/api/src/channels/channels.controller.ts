import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { botFlowSchema, channelPatchSchema, channelSchema } from "@aylluu/shared";
import { ChannelsService } from "./channels.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller()
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get("flows")
  listFlows(@CurrentTenant() tenant: TenantContext) {
    return this.channels.listFlows(tenant.companyId);
  }

  @Post("flows")
  createFlow(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(botFlowSchema)) body: unknown,
  ) {
    return this.channels.createFlow(tenant.companyId, user.id, body as never);
  }

  @Patch("flows/:id")
  updateFlow(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(botFlowSchema)) body: unknown,
  ) {
    return this.channels.updateFlow(tenant.companyId, id, user.id, body as never);
  }

  @Delete("flows/:id")
  removeFlow(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.channels.removeFlow(tenant.companyId, id);
  }

  @Get("channels")
  listChannels(@CurrentTenant() tenant: TenantContext) {
    return this.channels.listChannels(tenant.companyId);
  }

  @Post("channels")
  createChannel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(channelSchema)) body: unknown,
  ) {
    return this.channels.createChannel(tenant.companyId, user.id, body as never);
  }

  @Patch("channels/:id")
  updateChannel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(channelPatchSchema)) body: unknown,
  ) {
    return this.channels.updateChannel(tenant.companyId, id, user.id, body as never);
  }

  @Delete("channels/:id")
  removeChannel(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.channels.removeChannel(tenant.companyId, id);
  }
}
