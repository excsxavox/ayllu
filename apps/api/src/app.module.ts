import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt.guard";
import { TenantGuard } from "./auth/tenant.guard";
import { RolesGuard } from "./auth/roles.guard";
import { CompaniesModule } from "./companies/companies.module";
import { CatalogModule } from "./catalog/catalog.module";
import { RulesModule } from "./rules/rules.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { BotModule } from "./bot/bot.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { AlertsModule } from "./alerts/alerts.module";
import { RepliesModule } from "./replies/replies.module";
import { SetupModule } from "./setup/setup.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ChannelsModule } from "./channels/channels.module";
import { ContactsModule } from "./contacts/contacts.module";
import { PaymentsModule } from "./payments/payments.module";
import { AppController } from "./app.controller";
import { DashboardService } from "./dashboard/dashboard.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const raw = config.get("REDIS_URL") ?? "redis://localhost:6379";
        const url = new URL(raw);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
          },
        };
      },
    }),
    PrismaModule,
    CommonModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    CatalogModule,
    RulesModule,
    KnowledgeModule,
    WhatsAppModule,
    BotModule,
    ConversationsModule,
    AlertsModule,
    RepliesModule,
    SetupModule,
    BookingsModule,
    ChannelsModule,
    ContactsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    DashboardService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
