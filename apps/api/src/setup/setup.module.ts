import { Module } from "@nestjs/common";
import { SetupService } from "./setup.service";
import { SetupController } from "./setup.controller";
import { AlertsModule } from "../alerts/alerts.module";

@Module({
  imports: [AlertsModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
