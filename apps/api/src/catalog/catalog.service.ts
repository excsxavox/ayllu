import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CategoryInput,
  PriceInput,
  ProductInput,
  PromotionInput,
  ServiceInput,
  TagInput,
} from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { CryptoService } from "../common/crypto.service";

const WA_LABEL_COLORS = [
  "#ff9485",
  "#64c4ff",
  "#ffd429",
  "#d3a3ff",
  "#a9abac",
  "#5dd8c0",
  "#c48cff",
  "#cba76b",
  "#6d9ce6",
  "#b5e36a",
];

const WA_PRESET_LABELS = [
  { name: "Nuevo cliente", color: "#ff9485" },
  { name: "Pedido nuevo", color: "#64c4ff" },
  { name: "Pago pendiente", color: "#ffd429" },
  { name: "Pagado", color: "#d3a3ff" },
  { name: "Pedido completado", color: "#5dd8c0" },
  { name: "Importante", color: "#ff7b5a" },
  { name: "Seguimiento", color: "#6d9ce6" },
];

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly knowledge: KnowledgeService,
    private readonly crypto: CryptoService,
  ) {}

  private scoped(companyId: string) {
    return { companyId };
  }

  async assertOwned<T extends { companyId: string }>(
    entity: T | null,
    companyId: string,
    label: string,
  ): Promise<T> {
    if (!entity || entity.companyId !== companyId) {
      throw new NotFoundException(`${label} no encontrado`);
    }
    return entity;
  }

  listCategories(companyId: string) {
    return this.prisma.category.findMany({
      where: this.scoped(companyId),
      orderBy: { name: "asc" },
    });
  }

  async createCategory(companyId: string, userId: string, input: CategoryInput) {
    const row = await this.prisma.category.create({
      data: { companyId, name: input.name },
    });
    await this.audit.log({
      companyId,
      userId,
      action: "category.create",
      entity: "Category",
      entityId: row.id,
    });
    return row;
  }

  async updateCategory(companyId: string, id: string, input: CategoryInput) {
    await this.assertOwned(
      await this.prisma.category.findUnique({ where: { id } }),
      companyId,
      "Categoría",
    );
    return this.prisma.category.update({ where: { id }, data: { name: input.name } });
  }

  async deleteCategory(companyId: string, id: string) {
    await this.assertOwned(
      await this.prisma.category.findUnique({ where: { id } }),
      companyId,
      "Categoría",
    );
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  listProducts(companyId: string) {
    return this.prisma.product.findMany({
      where: this.scoped(companyId),
      include: {
        category: true,
        prices: true,
        tags: { include: { tag: true } },
        parentService: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async createProduct(companyId: string, userId: string, input: ProductInput) {
    await this.assertParentService(companyId, input.parentServiceId);
    const row = await this.prisma.product.create({
      data: {
        companyId,
        name: input.name,
        description: input.description ?? null,
        sku: input.sku ?? null,
        categoryId: input.categoryId ?? null,
        parentServiceId: input.parentServiceId ?? null,
        isActive: input.isActive ?? true,
        isAddon: input.isAddon ?? false,
        stock: input.stock ?? null,
        imageUrls: input.imageUrls ?? [],
        links: input.links ?? [],
      },
      include: { prices: true, tags: { include: { tag: true } }, parentService: { select: { id: true, name: true } } },
    });
    await this.knowledge.indexCatalogItem(
      companyId,
      "product",
      row.id,
      row.name,
      this.productIndexText(row),
    );
    await this.audit.log({
      companyId,
      userId,
      action: "product.create",
      entity: "Product",
      entityId: row.id,
    });
    return row;
  }

  async updateProduct(companyId: string, id: string, input: ProductInput) {
    await this.assertOwned(
      await this.prisma.product.findUnique({ where: { id } }),
      companyId,
      "Producto",
    );
    await this.assertParentService(companyId, input.parentServiceId);
    const row = await this.prisma.product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        sku: input.sku ?? null,
        categoryId: input.categoryId ?? null,
        parentServiceId: input.parentServiceId ?? null,
        isActive: input.isActive ?? true,
        isAddon: input.isAddon ?? false,
        stock: input.stock ?? null,
        imageUrls: input.imageUrls ?? [],
        links: input.links ?? [],
      },
      include: { prices: true, tags: { include: { tag: true } }, parentService: { select: { id: true, name: true } } },
    });
    await this.knowledge.indexCatalogItem(
      companyId,
      "product",
      row.id,
      row.name,
      this.productIndexText(row),
    );
    return row;
  }

  async deleteProduct(companyId: string, id: string) {
    await this.assertOwned(
      await this.prisma.product.findUnique({ where: { id } }),
      companyId,
      "Producto",
    );
    await this.knowledge.removeCatalogItem(companyId, "product", id);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  listServices(companyId: string) {
    return this.prisma.service.findMany({
      where: this.scoped(companyId),
      include: {
        category: true,
        prices: true,
        tags: { include: { tag: true } },
        addOns: { where: { isActive: true }, select: { id: true, name: true, stock: true, isAddon: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async createService(companyId: string, userId: string, input: ServiceInput) {
    const row = await this.prisma.service.create({
      data: {
        companyId,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes ?? null,
        categoryId: input.categoryId ?? null,
        isActive: input.isActive ?? true,
        imageUrls: input.imageUrls ?? [],
      },
      include: { prices: true, tags: { include: { tag: true } } },
    });
    await this.knowledge.indexCatalogItem(companyId, "service", row.id, row.name, row.description);
    await this.audit.log({
      companyId,
      userId,
      action: "service.create",
      entity: "Service",
      entityId: row.id,
    });
    return row;
  }

  async updateService(companyId: string, id: string, input: ServiceInput) {
    await this.assertOwned(
      await this.prisma.service.findUnique({ where: { id } }),
      companyId,
      "Servicio",
    );
    const row = await this.prisma.service.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes ?? null,
        categoryId: input.categoryId ?? null,
        isActive: input.isActive ?? true,
        ...(input.imageUrls !== undefined ? { imageUrls: input.imageUrls } : {}),
      },
      include: { prices: true, tags: { include: { tag: true } } },
    });
    await this.knowledge.indexCatalogItem(companyId, "service", row.id, row.name, row.description);
    return row;
  }

  async deleteService(companyId: string, id: string) {
    await this.assertOwned(
      await this.prisma.service.findUnique({ where: { id } }),
      companyId,
      "Servicio",
    );
    await this.knowledge.removeCatalogItem(companyId, "service", id);
    await this.prisma.service.delete({ where: { id } });
    return { ok: true };
  }

  listPrices(companyId: string, productId?: string, serviceId?: string) {
    return this.prisma.price.findMany({
      where: {
        companyId,
        ...(productId ? { productId } : {}),
        ...(serviceId ? { serviceId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPrice(companyId: string, userId: string, input: PriceInput) {
    if (!input.productId && !input.serviceId) {
      throw new BadRequestException("El precio requiere productId o serviceId");
    }
    if (input.productId) {
      await this.assertOwned(
        await this.prisma.product.findUnique({ where: { id: input.productId } }),
        companyId,
        "Producto",
      );
    }
    if (input.serviceId) {
      await this.assertOwned(
        await this.prisma.service.findUnique({ where: { id: input.serviceId } }),
        companyId,
        "Servicio",
      );
    }
    if (input.isDefault) {
      await this.prisma.price.updateMany({
        where: {
          companyId,
          productId: input.productId ?? null,
          serviceId: input.serviceId ?? null,
        },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.price.create({
      data: {
        companyId,
        amount: input.amount,
        currency: input.currency ?? "USD",
        label: input.label ?? "regular",
        isDefault: input.isDefault ?? false,
        productId: input.productId ?? null,
        serviceId: input.serviceId ?? null,
      },
    });
    await this.audit.log({
      companyId,
      userId,
      action: "price.create",
      entity: "Price",
      entityId: row.id,
    });
    return row;
  }

  async updatePrice(companyId: string, id: string, input: PriceInput) {
    const existing = await this.prisma.price.findUnique({ where: { id } });
    await this.assertOwned(existing, companyId, "Precio");
    if (input.isDefault) {
      await this.prisma.price.updateMany({
        where: {
          companyId,
          productId: existing!.productId,
          serviceId: existing!.serviceId,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }
    return this.prisma.price.update({
      where: { id },
      data: {
        amount: input.amount,
        currency: input.currency ?? existing!.currency,
        label: input.label ?? existing!.label,
        isDefault: input.isDefault ?? existing!.isDefault,
      },
    });
  }

  async deletePrice(companyId: string, id: string) {
    await this.assertOwned(
      await this.prisma.price.findUnique({ where: { id } }),
      companyId,
      "Precio",
    );
    await this.prisma.price.delete({ where: { id } });
    return { ok: true };
  }

  listTags(companyId: string) {
    return this.prisma.tag.findMany({
      where: this.scoped(companyId),
      include: {
        _count: { select: { contacts: true, products: true, services: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async importWhatsAppLabels(companyId: string, userId: string) {
    const fromMeta = await this.fetchMetaLabels(companyId);
    const incoming = fromMeta.length ? fromMeta : WA_PRESET_LABELS;
    const existing = await this.prisma.tag.findMany({ where: { companyId } });
    const byName = new Map(existing.map((tag) => [tag.name.trim().toLowerCase(), tag]));
    let created = 0;
    for (const label of incoming) {
      const key = label.name.trim().toLowerCase();
      if (!key || byName.has(key)) continue;
      const row = await this.prisma.tag.create({
        data: { companyId, name: label.name.trim(), color: label.color },
      });
      byName.set(key, row);
      created += 1;
    }
    await this.audit.log({
      companyId,
      userId,
      action: "tag.import_whatsapp",
      entity: "Tag",
      payload: { created, source: fromMeta.length ? "meta" : "whatsapp-presets" },
    });
    return {
      source: fromMeta.length ? "meta" : "whatsapp-presets",
      created,
      total: byName.size,
      items: await this.listTags(companyId),
    };
  }

  private async fetchMetaLabels(companyId: string): Promise<{ name: string; color: string }[]> {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { companyId, isActive: true, NOT: { phoneNumberId: { startsWith: "alpha-demo" } } },
      orderBy: { updatedAt: "desc" },
    });
    const token = this.crypto.decryptOrNull(account?.accessTokenEnc);
    const wabaId = account?.wabaId;
    if (!token || !wabaId) return [];
    const urls = [
      `https://graph.facebook.com/v21.0/${wabaId}/labels?fields=id,name,color`,
      `https://graph.facebook.com/v21.0/${wabaId}?fields=labels`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) continue;
        const json = (await res.json()) as {
          data?: { name?: string; color?: string | number }[];
          labels?: { data?: { name?: string; color?: string | number }[] };
        };
        const rows = json.data ?? json.labels?.data ?? [];
        const mapped = rows
          .map((row) => ({
            name: String(row.name ?? "").trim(),
            color:
              typeof row.color === "number"
                ? WA_LABEL_COLORS[row.color] ?? "#147d63"
                : row.color || "#147d63",
          }))
          .filter((row) => row.name);
        if (mapped.length) return mapped;
      } catch {
        // Meta no expone etiquetas en todas las cuentas; usamos las de la app Business.
      }
    }
    return [];
  }

  async createTag(companyId: string, userId: string, input: TagInput) {
    const row = await this.prisma.tag.create({
      data: { companyId, name: input.name, color: input.color ?? null },
    });
    await this.audit.log({
      companyId,
      userId,
      action: "tag.create",
      entity: "Tag",
      entityId: row.id,
    });
    return row;
  }

  async updateTag(companyId: string, id: string, input: TagInput) {
    await this.assertOwned(await this.prisma.tag.findUnique({ where: { id } }), companyId, "Etiqueta");
    return this.prisma.tag.update({
      where: { id },
      data: { name: input.name, color: input.color ?? null },
    });
  }

  async deleteTag(companyId: string, id: string) {
    await this.assertOwned(await this.prisma.tag.findUnique({ where: { id } }), companyId, "Etiqueta");
    await this.prisma.tag.delete({ where: { id } });
    return { ok: true };
  }

  async setProductTags(companyId: string, productId: string, tagIds: string[]) {
    await this.assertOwned(
      await this.prisma.product.findUnique({ where: { id: productId } }),
      companyId,
      "Producto",
    );
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, companyId },
    });
    await this.prisma.productTag.deleteMany({ where: { productId } });
    if (tags.length) {
      await this.prisma.productTag.createMany({
        data: tags.map((t) => ({ productId, tagId: t.id })),
      });
    }
    return this.prisma.product.findUnique({
      where: { id: productId },
      include: { tags: { include: { tag: true } } },
    });
  }

  async setServiceTags(companyId: string, serviceId: string, tagIds: string[]) {
    await this.assertOwned(
      await this.prisma.service.findUnique({ where: { id: serviceId } }),
      companyId,
      "Servicio",
    );
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, companyId },
    });
    await this.prisma.serviceTag.deleteMany({ where: { serviceId } });
    if (tags.length) {
      await this.prisma.serviceTag.createMany({
        data: tags.map((t) => ({ serviceId, tagId: t.id })),
      });
    }
    return this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { tags: { include: { tag: true } } },
    });
  }

  listPromotions(companyId: string) {
    return this.prisma.promotion.findMany({
      where: this.scoped(companyId),
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPromotion(companyId: string, userId: string, input: PromotionInput) {
    const row = await this.prisma.promotion.create({
      data: {
        companyId,
        name: input.name,
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        code: input.code ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        isActive: input.isActive ?? true,
        imageUrls: input.imageUrls ?? [],
        items: {
          create: [
            ...(input.productIds ?? []).map((productId) => ({ productId })),
            ...(input.serviceIds ?? []).map((serviceId) => ({ serviceId })),
          ],
        },
      },
      include: { items: true },
    });
    await this.audit.log({
      companyId,
      userId,
      action: "promotion.create",
      entity: "Promotion",
      entityId: row.id,
    });
    return row;
  }

  async updatePromotion(companyId: string, id: string, input: PromotionInput) {
    await this.assertOwned(
      await this.prisma.promotion.findUnique({ where: { id } }),
      companyId,
      "Promoción",
    );
    await this.prisma.promotionItem.deleteMany({ where: { promotionId: id } });
    return this.prisma.promotion.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        code: input.code ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        isActive: input.isActive ?? true,
        imageUrls: input.imageUrls ?? [],
        items: {
          create: [
            ...(input.productIds ?? []).map((productId) => ({ productId })),
            ...(input.serviceIds ?? []).map((serviceId) => ({ serviceId })),
          ],
        },
      },
      include: { items: true },
    });
  }

  async deletePromotion(companyId: string, id: string) {
    await this.assertOwned(
      await this.prisma.promotion.findUnique({ where: { id } }),
      companyId,
      "Promoción",
    );
    await this.prisma.promotion.delete({ where: { id } });
    return { ok: true };
  }

  private async assertParentService(companyId: string, parentServiceId?: string | null) {
    if (!parentServiceId) return;
    const parent = await this.prisma.service.findFirst({
      where: { id: parentServiceId, companyId },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException("El servicio padre no existe en esta empresa");
  }

  private productIndexText(row: {
    description?: string | null;
    imageUrls?: string[];
    links?: unknown;
    isAddon?: boolean;
    stock?: number | null;
  }) {
    const links = parseProductLinks(row.links);
    return [
      row.isAddon
        ? "Complemento de un servicio. No se ofrece como producto principal ni se vende suelto."
        : "",
      row.stock != null ? `Stock limitado: ${row.stock}` : "",
      row.description ?? "",
      row.imageUrls?.length ? `Fotos: ${row.imageUrls.join(" ")}` : "",
      ...links.map((l) => `Enlace ${l.label}: ${l.url}`),
    ]
      .filter(Boolean)
      .join("\n");
  }
}

export function parseProductLinks(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is { label: string; url: string } =>
      !!item &&
      typeof item === "object" &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { url?: unknown }).url === "string",
  );
}
