import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AlertsService } from "../alerts/alerts.service";

export const SETUP_STEPS = [
  { id: "empresa", title: "Empresa", hint: "Nombre, zona horaria y tono del bot" },
  { id: "canal", title: "Canal WhatsApp", hint: "Número y tokens del proveedor" },
  { id: "catalogo", title: "Catálogo", hint: "Al menos un producto o servicio" },
  { id: "conocimiento", title: "Conocimiento", hint: "FAQ o documento para el bot" },
  { id: "reglas", title: "Reglas", hint: "Saludo, horario o handover" },
  { id: "alertas", title: "Alertas", hint: "Avisos cuando el bot necesita un humano" },
  { id: "respuestas", title: "Formas de responder", hint: "Modo automático y plantillas" },
] as const;

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async status(companyId: string) {
    await this.alerts.ensureDefaults(companyId);
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const [wa, products, services, docs, rules, canned, alertSettings] = await Promise.all([
      this.prisma.whatsAppAccount.count({ where: { companyId } }),
      this.prisma.product.count({ where: { companyId } }),
      this.prisma.service.count({ where: { companyId } }),
      this.prisma.knowledgeDocument.count({ where: { companyId } }),
      this.prisma.businessRule.count({ where: { companyId } }),
      this.prisma.cannedReply.count({ where: { companyId } }),
      this.prisma.alertSetting.count({ where: { companyId } }),
    ]);

    const done: Record<string, boolean> = {
      empresa: Boolean(company.name && company.timezone),
      canal: wa > 0,
      catalogo: products + services > 0,
      conocimiento: docs > 0,
      reglas: rules > 0,
      alertas: alertSettings > 0,
      respuestas: canned > 0,
    };
    const steps = SETUP_STEPS.map((step, index) => ({
      ...step,
      index,
      done: done[step.id],
    }));
    const completedCount = steps.filter((s) => s.done).length;
    const next = steps.find((s) => !s.done)?.id ?? null;
    const complete = completedCount === steps.length;
    if (complete && !company.setupCompleted) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { setupCompleted: true },
      });
    }
    return {
      company: {
        id: company.id,
        name: company.name,
        timezone: company.timezone,
        botTone: company.botTone,
        botSystemPrompt: company.botSystemPrompt,
        replyMode: company.replyMode,
        setupCompleted: complete,
      },
      steps,
      completedCount,
      total: steps.length,
      next,
    };
  }
}
