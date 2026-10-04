import { Injectable } from "@nestjs/common";
import { NormalizedInboundMessage } from "@aylluu/shared";
import { WebhookQuery, WhatsAppChannel } from "./provider.interface";

/** Stub listo para Evolution API / Baileys sin tocar el orquestador. */
@Injectable()
export class EvolutionProvider implements WhatsAppChannel {
  readonly provider = "EVOLUTION" as const;

  verifyWebhook(query: WebhookQuery, expectedToken: string): string | null {
    if (query["hub.verify_token"] === expectedToken) return query["hub.challenge"] ?? "ok";
    return null;
  }

  parseInbound(payload: unknown): NormalizedInboundMessage[] {
    const body = payload as {
      data?: {
        key?: { remoteJid?: string; id?: string };
        pushName?: string;
        message?: { conversation?: string; extendedTextMessage?: { text?: string } };
      };
      instance?: string;
    };
    const text =
      body.data?.message?.conversation ??
      body.data?.message?.extendedTextMessage?.text ??
      "";
    const from = (body.data?.key?.remoteJid ?? "").replace("@s.whatsapp.net", "");
    if (!from || !text) return [];
    return [
      {
        provider: "EVOLUTION",
        phoneNumberId: body.instance ?? "evolution",
        from,
        contactName: body.data?.pushName,
        providerMessageId: body.data?.key?.id ?? `${Date.now()}`,
        type: "text",
        text,
        timestamp: String(Math.floor(Date.now() / 1000)),
        raw: payload,
      },
    ];
  }

  async sendText(): Promise<{ providerMessageId?: string }> {
    throw new Error("EvolutionProvider no está configurado aún");
  }

  async sendImage(): Promise<{ providerMessageId?: string }> {
    throw new Error("EvolutionProvider no está configurado aún");
  }
}
