import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CatalogController } from "./catalog.controller";
import { UploadsController } from "./uploads.controller";
import { KnowledgeModule } from "../knowledge/knowledge.module";

@Module({
  imports: [KnowledgeModule],
  controllers: [CatalogController, UploadsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
