import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { BotService } from "./bot.service";
import { CurrentTenant } from "../auth/decorators";
import { TenantContext } from "../common/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";

const simulateSchema = z.object({
  from: z.string().min(2).max(40).default("51999999999"),
  text: z.string().min(1).max(2000),
  contactName: z.string().optional(),
  channelId: z.string().min(1).optional(),
});

@Controller("bot")
export class BotController {
  constructor(
    private readonly bot: BotService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("simulate")
  async simulate(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(simulateSchema)) body: {
      from: string;
      text: string;
      contactName?: string;
      channelId?: string;
    },
  ) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: tenant.companyId },
    });
    const channel = body.channelId
      ? await this.prisma.channel.findFirst({
          where: { id: body.channelId, companyId: tenant.companyId },
          include: { flow: true, whatsappAccount: true },
        })
      : await this.prisma.channel.findFirst({
          where: { companyId: tenant.companyId, type: "WHATSAPP" },
          include: { flow: true, whatsappAccount: true },
        });
    if (!channel) {
      return { error: "Crea un canal en Canales antes de simular" };
    }
    const account =
      channel.whatsappAccount ??
      (await this.prisma.whatsAppAccount.findFirst({
        where: { companyId: tenant.companyId },
      }));
    return this.bot.handleChannelInbound({
      company,
      channel,
      account,
      from: body.from,
      contactName: body.contactName ?? "Simulado",
      text: body.text,
      type: "text",
      providerMessageId: `sim-${channel.type}-${Date.now()}`,
      raw: { simulated: true, channelId: channel.id },
    });
  }
}
