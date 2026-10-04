import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { NormalizedInboundMessage } from "@aylluu/shared";
import { BotService, ComposeJobData } from "./bot.service";

export const INBOUND_QUEUE = "whatsapp-inbound";

@Processor(INBOUND_QUEUE)
export class InboundProcessor extends WorkerHost {
  constructor(private readonly bot: BotService) {
    super();
  }

  async process(job: Job<NormalizedInboundMessage | ComposeJobData>) {
    try {
      if (job.name === "compose") {
        return await this.bot.composeDeferredReply(job.data as ComposeJobData);
      }
      return await this.bot.handleInbound(job.data as NormalizedInboundMessage);
    } catch (err) {
      if (job.name === "compose") {
        return this.bot.composeDeferredReply(job.data as ComposeJobData);
      }
      throw err;
    }
  }
}
