import { Module } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { BotModule } from "../bot/bot.module";
import { RepliesModule } from "../replies/replies.module";

@Module({
  imports: [BotModule, RepliesModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
