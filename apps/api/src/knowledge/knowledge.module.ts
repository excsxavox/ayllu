import { Module } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeController } from "./knowledge.controller";
import { LlmService } from "./llm.service";

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, LlmService],
  exports: [KnowledgeService, LlmService],
})
export class KnowledgeModule {}
