import { ChannelType, PrismaClient } from "@prisma/client";

type MessagingDb = Pick<
  PrismaClient,
  "company" | "botFlow" | "channel" | "whatsAppAccount" | "conversation"
>;

const PRESETS: Array<{ type: ChannelType; name: string; handle: string | null; isActive: boolean }> = [
  { type: "WHATSAPP", name: "WhatsApp", handle: null, isActive: true },
];

export async function ensureCompanyMessaging(prisma: MessagingDb, companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  let flow = await prisma.botFlow.findFirst({
    where: { companyId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (!flow) {
    flow = await prisma.botFlow.create({
      data: {
        companyId,
        name: "Flujo principal",
        description: "Responde con el catálogo, el conocimiento y las reglas de la empresa.",
        isDefault: true,
        systemPrompt: company.botSystemPrompt,
        tone: company.botTone,
        replyMode: company.replyMode,
      },
    });
  }

  for (const preset of PRESETS) {
    const existing = await prisma.channel.findFirst({
      where: { companyId, type: preset.type },
      orderBy: { createdAt: "asc" },
    });
    if (existing) continue;
    await prisma.channel.create({
      data: {
        companyId,
        type: preset.type,
        name: preset.name,
        handle: preset.handle,
        isActive: preset.isActive,
        flowId: flow.id,
      },
    });
  }

  const waChannel = await prisma.channel.findFirst({
    where: { companyId, type: "WHATSAPP" },
    orderBy: { createdAt: "asc" },
  });
  if (waChannel) {
    const unbound = await prisma.whatsAppAccount.findFirst({
      where: { companyId, channelId: null },
      orderBy: { createdAt: "asc" },
    });
    const channelTaken = await prisma.whatsAppAccount.findFirst({
      where: { channelId: waChannel.id },
    });
    if (unbound && !channelTaken) {
      await prisma.whatsAppAccount.update({
        where: { id: unbound.id },
        data: { channelId: waChannel.id },
      });
    }
    if (unbound?.displayPhone && !waChannel.handle) {
      await prisma.channel.update({
        where: { id: waChannel.id },
        data: { handle: unbound.displayPhone },
      });
    }
    await prisma.conversation.updateMany({
      where: { companyId, channelId: null },
      data: { channelId: waChannel.id },
    });
  }

  return flow;
}
