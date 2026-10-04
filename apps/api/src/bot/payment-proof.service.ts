import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../knowledge/llm.service";
import { AlertsService } from "../alerts/alerts.service";
import { PaymentsService } from "../payments/payments.service";
import { WhatsAppAdapterService } from "../whatsapp/whatsapp-adapter.service";
import { CryptoService } from "../common/crypto.service";
import { findMatchingAccount, parseReceiptScan } from "../payments/receipt-match";
import type { ReplyLocale } from "./bot-context";
import type { Contact, Conversation, WhatsAppAccount } from "@prisma/client";

@Injectable()
export class PaymentProofService {
  private readonly logger = new Logger(PaymentProofService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly alerts: AlertsService,
    private readonly payments: PaymentsService,
    private readonly adapter: WhatsAppAdapterService,
    private readonly crypto: CryptoService,
  ) {}

  async review(params: {
    companyId: string;
    conversation: Conversation;
    contact: Contact;
    account?: WhatsAppAccount | null;
    mediaId?: string;
    mimeType?: string;
    caption?: string;
    locale: ReplyLocale;
  }): Promise<string> {
    const methods = (await this.payments.listActive(params.companyId)).filter(
      (method) => method.type === "TRANSFER" && method.accountNumber,
    );
    const expected = methods
      .map((method) => [method.bank, method.accountNumber, method.accountHolder].filter(Boolean).join(" "))
      .join(" | ");

    let scan = parseReceiptScan(params.caption ?? "");
    const media = await this.loadMedia(params.account, params.mediaId);
    if (media) {
      const raw = await this.llm.inspectImage(
        params.companyId,
        "Lees comprobantes de transferencia. Responde SOLO JSON válido, sin markdown.",
        `Extrae datos del comprobante. Cuentas de la empresa: ${expected || "ninguna cargada"}. JSON: {"accountNumber":"","amount":"","bank":"","looksLikeTransfer":true}`,
        media.buffer,
        media.mimeType,
      );
      if (raw) scan = parseReceiptScan(raw);
    }

    const match = findMatchingAccount(scan.accountNumber, methods);
    const status = !media
      ? "sin archivo"
      : match
        ? "la cuenta coincide"
        : scan.looksLikeTransfer
          ? "no coincide la cuenta"
          : "no se leyó bien";

    await this.alerts.raise({
      companyId: params.companyId,
      type: "PAYMENT_PROOF",
      title: match
        ? "Comprobante de reserva · validar pago"
        : "Comprobante de reserva · revisar",
      body: [
        `${params.contact.name || params.contact.phone}`,
        status,
        scan.accountNumber ? `cuenta leída ${scan.accountNumber}` : "",
        match ? `cuenta de ${match.name}` : "",
        scan.amount ? `monto ${scan.amount}` : "",
        scan.bank ? `banco ${scan.bank}` : "",
        params.caption ? `nota: ${params.caption.slice(0, 80)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      conversationId: params.conversation.id,
    });

    this.logger.log(`Comprobante ${params.conversation.id}: ${status}`);

    if (params.locale === "en") {
      return match
        ? "I received the transfer screenshot. The team will check the deposit and confirm the booking."
        : "I received the photo. The team will review it to confirm the payment.";
    }
    return match
      ? "Recibí el comprobante. El equipo valida el depósito y te confirma la reserva."
      : "Recibí la foto. El equipo la revisa para validar el pago.";
  }

  private async loadMedia(account: WhatsAppAccount | null | undefined, mediaId?: string) {
    if (!account || !mediaId) return null;
    const token = this.crypto.decryptOrNull(account.accessTokenEnc);
    const download = this.adapter.resolve(account.provider).downloadMedia;
    if (!token || !download) return null;
    try {
      return await download({ accessToken: token, mediaId });
    } catch (err) {
      this.logger.warn(`No se pudo bajar el comprobante: ${(err as Error).message}`);
      return null;
    }
  }
}
