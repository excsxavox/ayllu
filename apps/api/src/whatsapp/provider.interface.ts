import { NormalizedInboundMessage, WhatsAppProvider } from "@aylluu/shared";

export type WebhookQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

export interface WhatsAppChannel {
  readonly provider: WhatsAppProvider;
  verifyWebhook(query: WebhookQuery, expectedToken: string): string | null;
  parseInbound(payload: unknown): NormalizedInboundMessage[];
  sendText(params: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    text: string;
  }): Promise<{ providerMessageId?: string }>;
  sendImage?(params: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    imageUrl?: string;
    filePath?: string;
    caption?: string;
  }): Promise<{ providerMessageId?: string }>;
  verifySignature?(rawBody: Buffer, signature: string | undefined, appSecret: string): boolean;
  downloadMedia?(params: {
    accessToken: string;
    mediaId: string;
  }): Promise<{ buffer: Buffer; mimeType: string } | null>;
}
