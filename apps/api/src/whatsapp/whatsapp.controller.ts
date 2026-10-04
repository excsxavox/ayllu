import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { aiSettingsSchema, whatsappSettingsSchema } from "@aylluu/shared";
import { Public, CurrentTenant, CurrentUser } from "../auth/decorators";
import { AuthUser, TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";
import { WhatsAppAdapterService } from "./whatsapp-adapter.service";
import { INBOUND_QUEUE } from "../bot/inbound.processor";
import { AuditService } from "../audit/audit.service";
import { ensureCompanyMessaging } from "../channels/defaults";
import { Request, Response } from "express";

@Controller()
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly adapter: WhatsAppAdapterService,
    private readonly audit: AuditService,
    @InjectQueue(INBOUND_QUEUE) private readonly inboundQueue: Queue,
  ) {}

  @Get("settings/whatsapp")
  async getWhatsApp(@CurrentTenant() tenant: TenantContext) {
    const rows = await this.prisma.whatsAppAccount.findMany({
      where: { companyId: tenant.companyId },
      orderBy: { updatedAt: "desc" },
    });
    const row =
      rows.find((item) => /^\d+$/.test(item.phoneNumberId)) ??
      rows[0] ??
      null;
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      phoneNumberId: row.phoneNumberId,
      wabaId: row.wabaId,
      displayPhone: row.displayPhone,
      isActive: row.isActive,
      hasAccessToken: Boolean(row.accessTokenEnc),
      hasVerifyToken: Boolean(row.verifyTokenEnc),
      hasAppSecret: Boolean(row.appSecretEnc),
    };
  }

  @Put("settings/whatsapp")
  async putWhatsApp(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(whatsappSettingsSchema)) body: {
      provider?: "META" | "EVOLUTION" | "TWILIO";
      phoneNumberId: string;
      wabaId?: string | null;
      displayPhone?: string | null;
      accessToken?: string;
      verifyToken?: string;
      appSecret?: string;
      isActive?: boolean;
    },
  ) {
    const provider = body.provider ?? "META";
    const byPhone = await this.prisma.whatsAppAccount.findUnique({
      where: { provider_phoneNumberId: { provider, phoneNumberId: body.phoneNumberId } },
    });
    if (byPhone && byPhone.companyId !== tenant.companyId) {
      throw new UnauthorizedException("Ese número de WhatsApp ya está en otra empresa");
    }
    const existing =
      byPhone ??
      (await this.prisma.whatsAppAccount.findFirst({
        where: { companyId: tenant.companyId },
      }));
    const data = {
      provider,
      phoneNumberId: body.phoneNumberId,
      wabaId: body.wabaId ?? null,
      displayPhone: body.displayPhone ?? null,
      isActive: body.isActive ?? true,
      ...(body.accessToken ? { accessTokenEnc: this.crypto.encrypt(body.accessToken) } : {}),
      ...(body.verifyToken ? { verifyTokenEnc: this.crypto.encrypt(body.verifyToken) } : {}),
      ...(body.appSecret ? { appSecretEnc: this.crypto.encrypt(body.appSecret) } : {}),
    };
    const row = existing
      ? await this.prisma.whatsAppAccount.update({ where: { id: existing.id }, data })
      : await this.prisma.whatsAppAccount.create({
          data: { companyId: tenant.companyId, ...data },
        });
    await ensureCompanyMessaging(this.prisma, tenant.companyId);
    const waChannel = await this.prisma.channel.findFirst({
      where: { companyId: tenant.companyId, type: "WHATSAPP" },
      orderBy: { createdAt: "asc" },
    });
    const channelTaken = waChannel
      ? await this.prisma.whatsAppAccount.findFirst({
          where: { channelId: waChannel.id, NOT: { id: row.id } },
          select: { id: true },
        })
      : null;
    if (waChannel && !row.channelId && !channelTaken) {
      await this.prisma.whatsAppAccount.update({
        where: { id: row.id },
        data: { channelId: waChannel.id },
      });
      if (row.displayPhone) {
        await this.prisma.channel.update({
          where: { id: waChannel.id },
          data: { handle: row.displayPhone, isActive: row.isActive },
        });
      }
    } else if (waChannel && row.displayPhone) {
      await this.prisma.channel.update({
        where: { id: waChannel.id },
        data: { handle: row.displayPhone, isActive: row.isActive },
      });
    }
    await this.audit.log({
      companyId: tenant.companyId,
      userId: user.id,
      action: "whatsapp.settings.update",
      entity: "WhatsAppAccount",
      entityId: row.id,
    });
    return this.getWhatsApp(tenant);
  }

  @Get("settings/ai")
  async getAi(@CurrentTenant() tenant: TenantContext) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: tenant.companyId },
    });
    return {
      hasLlmApiKey: Boolean(company.llmApiKeyEnc),
      llmBaseUrl: company.llmBaseUrl,
      chatModel: company.chatModel,
      embeddingModel: company.embeddingModel,
      botSystemPrompt: company.botSystemPrompt,
      botTone: company.botTone,
      mapUrl: company.mapUrl,
    };
  }

  @Put("settings/ai")
  async putAi(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(aiSettingsSchema)) body: {
      llmApiKey?: string | null;
      llmBaseUrl?: string | null;
      chatModel?: string | null;
      embeddingModel?: string | null;
      botSystemPrompt?: string | null;
      botTone?: string | null;
      mapUrl?: string | null;
    },
  ) {
    await this.prisma.company.update({
      where: { id: tenant.companyId },
      data: {
        llmBaseUrl: body.llmBaseUrl ?? undefined,
        chatModel: body.chatModel ?? undefined,
        embeddingModel: body.embeddingModel ?? undefined,
        botSystemPrompt: body.botSystemPrompt ?? undefined,
        botTone: body.botTone ?? undefined,
        ...(body.mapUrl !== undefined ? { mapUrl: body.mapUrl || null } : {}),
        ...(body.llmApiKey === null
          ? { llmApiKeyEnc: null }
          : body.llmApiKey
            ? { llmApiKeyEnc: this.crypto.encrypt(body.llmApiKey) }
            : {}),
      },
    });
    await this.audit.log({
      companyId: tenant.companyId,
      userId: user.id,
      action: "ai.settings.update",
      entity: "Company",
      entityId: tenant.companyId,
    });
    return this.getAi(tenant);
  }

  @Public()
  @SkipThrottle()
  @Get("webhooks/whatsapp")
  async verify(
    @Query()
    query: { "hub.mode"?: string; "hub.verify_token"?: string; "hub.challenge"?: string },
    @Res() res: Response,
  ) {
    const challenge = await this.verifyChallenge(query);
    res.status(200).type("text/plain").send(challenge);
  }

  private async verifyChallenge(query: {
    "hub.mode"?: string;
    "hub.verify_token"?: string;
    "hub.challenge"?: string;
  }) {
    const token = query["hub.verify_token"] ?? "";
    const accounts = await this.prisma.whatsAppAccount.findMany({
      where: { isActive: true, verifyTokenEnc: { not: null } },
    });
    for (const account of accounts) {
      const expected = this.crypto.decryptOrNull(account.verifyTokenEnc);
      if (!expected) continue;
      const challenge = this.adapter.resolve(account.provider).verifyWebhook(query, expected);
      if (challenge !== null) return challenge;
    }
    throw new UnauthorizedException("Verify token inválido");
  }

  @Public()
  @SkipThrottle()
  @Post("webhooks/whatsapp")
  @HttpCode(200)
  async receiveInbound(
    @Body() body: unknown,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-hub-signature-256") signature?: string,
  ) {
    const messages = this.adapter.resolve("META").parseInbound(body);
    if (messages.length) {
      this.logger.log(`Webhook WhatsApp: ${messages.length} mensaje(s)`);
    }
    if (!messages.length) {
      const evo = this.adapter.resolve("EVOLUTION").parseInbound(body);
      messages.push(...evo);
    }

    for (const message of messages) {
      const account = await this.prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId: message.phoneNumberId, isActive: true },
      });
      if (account?.appSecretEnc && req.rawBody) {
        const secret = this.crypto.decryptOrNull(account.appSecretEnc);
        const channel = this.adapter.resolve(account.provider);
        if (secret && channel.verifySignature) {
          const ok = channel.verifySignature(req.rawBody, signature, secret);
          if (!ok) throw new UnauthorizedException("Firma inválida");
        }
      }
      await this.inboundQueue.add("message", message, {
        removeOnComplete: 1000,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      });
    }
    return { received: true };
  }
}
