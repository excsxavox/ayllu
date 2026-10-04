import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { KnowledgeDocumentInput } from "@aylluu/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "./llm.service";
import { AuditService } from "../audit/audit.service";
import { chunkText } from "./knowledge-chunk";

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async create(companyId: string, userId: string, input: KnowledgeDocumentInput) {
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        companyId,
        title: input.title,
        content: input.content,
        sourceType: input.sourceType ?? "FAQ",
      },
    });
    await this.reindexDocument(companyId, doc.id);
    await this.audit.log({
      companyId,
      userId,
      action: "knowledge.create",
      entity: "KnowledgeDocument",
      entityId: doc.id,
    });
    return doc;
  }

  async update(companyId: string, id: string, input: KnowledgeDocumentInput) {
    const existing = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Documento no encontrado");
    }
    const doc = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        title: input.title,
        content: input.content,
        sourceType: input.sourceType ?? existing.sourceType,
      },
    });
    await this.reindexDocument(companyId, doc.id);
    return doc;
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Documento no encontrado");
    }
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    return { ok: true };
  }

  async reindexDocument(companyId: string, documentId: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.companyId !== companyId) return;
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });
    const pieces = chunkText(doc.content).map((piece) => `${doc.title}\n${piece}`);
    const embeddings = await this.llm.embed(companyId, pieces);
    for (let i = 0; i < pieces.length; i++) {
      const chunk = await this.prisma.knowledgeChunk.create({
        data: {
          companyId,
          documentId,
          content: pieces[i],
          metadata: { sourceType: doc.sourceType, title: doc.title, index: i } as Prisma.InputJsonValue,
        },
      });
      if (embeddings?.[i]) {
        await this.storeEmbedding(chunk.id, embeddings[i]);
      }
    }
  }

  async indexCatalogItem(
    companyId: string,
    kind: "product" | "service",
    itemId: string,
    name: string,
    description?: string | null,
  ) {
    const title = `catalog:${kind}:${itemId}`;
    const content = [`${kind === "product" ? "Producto" : "Servicio"}: ${name}`, description ?? ""]
      .filter(Boolean)
      .join("\n");
    const existing = await this.prisma.knowledgeDocument.findFirst({
      where: {
        companyId,
        sourceType: "CATALOG",
        title,
      },
    });
    if (existing) {
      await this.prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { content },
      });
      await this.reindexDocument(companyId, existing.id);
      return;
    }
    const doc = await this.prisma.knowledgeDocument.create({
      data: { companyId, title, content, sourceType: "CATALOG" },
    });
    await this.reindexDocument(companyId, doc.id);
    void itemId;
  }

  async removeCatalogItem(companyId: string, kind: "product" | "service", itemId: string) {
    await this.prisma.knowledgeDocument.deleteMany({
      where: { companyId, sourceType: "CATALOG", title: `catalog:${kind}:${itemId}` },
    });
  }

  async retrieve(
    companyId: string,
    query: string,
    limitOrOpts: number | { limit?: number; sourceTypes?: Array<"FAQ" | "MANUAL" | "CATALOG"> } = 6,
  ): Promise<string[]> {
    const opts = typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts;
    const limit = opts.limit ?? 6;
    const sourceTypes = opts.sourceTypes?.filter(Boolean);
    if (limit <= 0) return [];

    const embeddings = await this.llm.embed(companyId, [query]);
    if (embeddings?.[0]) {
      const vector = `[${embeddings[0].join(",")}]`;
      const rows = sourceTypes?.length
        ? await this.prisma.$queryRaw<Array<{ content: string }>>`
            SELECT kc.content
            FROM "KnowledgeChunk" kc
            INNER JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
            WHERE kc."companyId" = ${companyId}
              AND kc.embedding IS NOT NULL
              AND kd."sourceType"::text IN (${Prisma.join(sourceTypes)})
            ORDER BY kc.embedding <-> ${vector}::vector
            LIMIT ${limit}
          `
        : await this.prisma.$queryRaw<Array<{ content: string }>>`
            SELECT content
            FROM "KnowledgeChunk"
            WHERE "companyId" = ${companyId}
              AND embedding IS NOT NULL
            ORDER BY embedding <-> ${vector}::vector
            LIMIT ${limit}
          `;
      if (rows.length) return rows.map((r) => r.content);
    }

    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((w) => w.length > 3)
      .slice(0, 6);
    if (!tokens.length) return [];

    const fallback = await this.prisma.knowledgeChunk.findMany({
      where: {
        companyId,
        OR: tokens.map((w) => ({ content: { contains: w, mode: "insensitive" as const } })),
        ...(sourceTypes?.length ? { document: { sourceType: { in: sourceTypes } } } : {}),
      },
      take: limit,
    });
    return fallback.map((c) => c.content);
  }

  private async storeEmbedding(chunkId: string, embedding: number[]) {
    const vector = `[${embedding.join(",")}]`;
    try {
      await this.prisma.$executeRaw`
        UPDATE "KnowledgeChunk"
        SET embedding = ${vector}::vector
        WHERE id = ${chunkId}
      `;
    } catch (err) {
      this.logger.warn(`No se pudo guardar embedding: ${(err as Error).message}`);
    }
  }
}
