import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MetaCloudApiProvider } from "./meta.provider";
import { EvolutionProvider } from "./evolution.provider";
import { WhatsAppAdapterService } from "./whatsapp-adapter.service";
import { WhatsAppController } from "./whatsapp.controller";
import { INBOUND_QUEUE } from "../bot/inbound.processor";

@Module({
  imports: [BullModule.registerQueue({ name: INBOUND_QUEUE })],
  controllers: [WhatsAppController],
  providers: [MetaCloudApiProvider, EvolutionProvider, WhatsAppAdapterService],
  exports: [WhatsAppAdapterService, MetaCloudApiProvider, EvolutionProvider],
})
export class WhatsAppModule {}
