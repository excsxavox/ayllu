import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BotService } from "./bot.service";
import { BotController } from "./bot.controller";
import { PaymentProofService } from "./payment-proof.service";
import { InboundProcessor, INBOUND_QUEUE } from "./inbound.processor";
import { RulesModule } from "../rules/rules.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { AlertsModule } from "../alerts/alerts.module";
import { RepliesModule } from "../replies/replies.module";
import { BookingsModule } from "../bookings/bookings.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: INBOUND_QUEUE }),
    RulesModule,
    KnowledgeModule,
    WhatsAppModule,
    AlertsModule,
    RepliesModule,
    BookingsModule,
    PaymentsModule,
  ],
  controllers: [BotController],
  providers: [BotService, PaymentProofService, InboundProcessor],
  exports: [BotService],
})
export class BotModule {}
