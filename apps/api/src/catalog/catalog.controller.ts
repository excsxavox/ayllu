import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  attachTagsSchema,
  categorySchema,
  priceSchema,
  productSchema,
  promotionSchema,
  serviceSchema,
  tagSchema,
} from "@aylluu/shared";
import { CatalogService } from "./catalog.service";
import { CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  listCategories(@CurrentTenant() tenant: TenantContext) {
    return this.catalog.listCategories(tenant.companyId);
  }

  @Post("categories")
  createCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(categorySchema)) body: unknown,
  ) {
    return this.catalog.createCategory(tenant.companyId, user.id, body as never);
  }

  @Patch("categories/:id")
  updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(categorySchema)) body: unknown,
  ) {
    return this.catalog.updateCategory(tenant.companyId, id, body as never);
  }

  @Delete("categories/:id")
  deleteCategory(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.catalog.deleteCategory(tenant.companyId, id);
  }

  @Get("products")
  listProducts(@CurrentTenant() tenant: TenantContext) {
    return this.catalog.listProducts(tenant.companyId);
  }

  @Post("products")
  createProduct(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(productSchema)) body: unknown,
  ) {
    return this.catalog.createProduct(tenant.companyId, user.id, body as never);
  }

  @Patch("products/:id")
  updateProduct(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(productSchema)) body: unknown,
  ) {
    return this.catalog.updateProduct(tenant.companyId, id, body as never);
  }

  @Delete("products/:id")
  deleteProduct(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.catalog.deleteProduct(tenant.companyId, id);
  }

  @Post("products/:id/tags")
  setProductTags(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(attachTagsSchema)) body: { tagIds: string[] },
  ) {
    return this.catalog.setProductTags(tenant.companyId, id, body.tagIds);
  }

  @Get("services")
  listServices(@CurrentTenant() tenant: TenantContext) {
    return this.catalog.listServices(tenant.companyId);
  }

  @Post("services")
  createService(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(serviceSchema)) body: unknown,
  ) {
    return this.catalog.createService(tenant.companyId, user.id, body as never);
  }

  @Patch("services/:id")
  updateService(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(serviceSchema)) body: unknown,
  ) {
    return this.catalog.updateService(tenant.companyId, id, body as never);
  }

  @Delete("services/:id")
  deleteService(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.catalog.deleteService(tenant.companyId, id);
  }

  @Post("services/:id/tags")
  setServiceTags(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(attachTagsSchema)) body: { tagIds: string[] },
  ) {
    return this.catalog.setServiceTags(tenant.companyId, id, body.tagIds);
  }

  @Get("prices")
  listPrices(
    @CurrentTenant() tenant: TenantContext,
    @Query("productId") productId?: string,
    @Query("serviceId") serviceId?: string,
  ) {
    return this.catalog.listPrices(tenant.companyId, productId, serviceId);
  }

  @Post("prices")
  createPrice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(priceSchema)) body: unknown,
  ) {
    return this.catalog.createPrice(tenant.companyId, user.id, body as never);
  }

  @Patch("prices/:id")
  updatePrice(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(priceSchema)) body: unknown,
  ) {
    return this.catalog.updatePrice(tenant.companyId, id, body as never);
  }

  @Delete("prices/:id")
  deletePrice(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.catalog.deletePrice(tenant.companyId, id);
  }

  @Get("tags")
  listTags(@CurrentTenant() tenant: TenantContext) {
    return this.catalog.listTags(tenant.companyId);
  }

  @Post("tags/whatsapp")
  importWhatsAppLabels(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: AuthUser) {
    return this.catalog.importWhatsAppLabels(tenant.companyId, user.id);
  }

  @Post("tags")
  createTag(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(tagSchema)) body: unknown,
  ) {
    return this.catalog.createTag(tenant.companyId, user.id, body as never);
  }

  @Patch("tags/:id")
  updateTag(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(tagSchema)) body: unknown,
  ) {
    return this.catalog.updateTag(tenant.companyId, id, body as never);
  }

  @Delete("tags/:id")
  deleteTag(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.catalog.deleteTag(tenant.companyId, id);
  }

  @Get("promotions")
  listPromotions(@CurrentTenant() tenant: TenantContext) {
    return this.catalog.listPromotions(tenant.companyId);
  }

  @Post("promotions")
  createPromotion(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(promotionSchema)) body: unknown,
  ) {
    return this.catalog.createPromotion(tenant.companyId, user.id, body as never);
  }

  @Patch("promotions/:id")
  updatePromotion(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(promotionSchema)) body: unknown,
  ) {
    return this.catalog.updatePromotion(tenant.companyId, id, body as never);
  }

  @Delete("promotions/:id")
  deletePromotion(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.catalog.deletePromotion(tenant.companyId, id);
  }
}
