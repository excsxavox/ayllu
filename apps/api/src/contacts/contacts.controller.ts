import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  CONTACT_AUDIENCES,
  contactNoteSchema,
  contactSchema,
  contactUpdateSchema,
  type ContactAudience,
} from "@aylluu/shared";
import { z } from "zod";
import { ContactsService } from "./contacts.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const contactTagSchema = z.object({ tagId: z.string().min(1) });

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query("audience") audience?: string) {
    const role = CONTACT_AUDIENCES.includes(audience as ContactAudience)
      ? (audience as ContactAudience)
      : undefined;
    return this.contacts.list(tenant.companyId, role);
  }

  @Get(":id")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.contacts.get(tenant.companyId, id);
  }

  @Post()
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(contactSchema)) body: unknown,
  ) {
    return this.contacts.create(tenant.companyId, user.id, body as never);
  }

  @Patch(":id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contactUpdateSchema)) body: unknown,
  ) {
    return this.contacts.update(tenant.companyId, user.id, id, body as never);
  }

  @Post(":id/notes")
  addNote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contactNoteSchema)) body: unknown,
  ) {
    return this.contacts.addNote(tenant.companyId, user.id, id, body as never);
  }

  @Post(":id/tags")
  addTag(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contactTagSchema)) body: { tagId: string },
  ) {
    return this.contacts.addTag(tenant.companyId, id, body.tagId);
  }

  @Delete(":id/tags/:tagId")
  removeTag(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    return this.contacts.removeTag(tenant.companyId, id, tagId);
  }

  @Delete(":id")
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.contacts.remove(tenant.companyId, user.id, id);
  }
}
