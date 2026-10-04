import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { sendInboxMessageSchema } from "@aylluu/shared";
import { z } from "zod";
import { ConversationsService } from "./conversations.service";
import { RepliesService } from "../replies/replies.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const contactTagSchema = z.object({ tagId: z.string().min(1) });

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly replies: RepliesService,
  ) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query("channelId") channelId?: string) {
    return this.conversations.list(tenant.companyId, channelId);
  }

  @Get(":id/suggestions")
  async suggestions(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    const conv = await this.conversations.get(tenant.companyId, id);
    const lastIn = [...conv.messages].reverse().find((m) => m.direction === "INBOUND");
    const matched = lastIn ? await this.replies.match(tenant.companyId, lastIn.content) : [];
    const all = await this.replies.list(tenant.companyId);
    return { matched, all };
  }

  @Get(":id")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.conversations.get(tenant.companyId, id);
  }

  @Post(":id/takeover")
  takeover(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.conversations.takeover(tenant.companyId, user.id, id, true);
  }

  @Post(":id/release")
  release(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.conversations.takeover(tenant.companyId, user.id, id, false);
  }

  @Post(":id/tags")
  addTag(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contactTagSchema)) body: { tagId: string },
  ) {
    return this.conversations.addContactTag(tenant.companyId, id, body.tagId);
  }

  @Delete(":id/tags/:tagId")
  removeTag(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    return this.conversations.removeContactTag(tenant.companyId, id, tagId);
  }

  @Post(":id/messages")
  send(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(sendInboxMessageSchema)) body: { text: string },
  ) {
    return this.conversations.sendFromInbox(tenant.companyId, user.id, id, body.text);
  }
}
