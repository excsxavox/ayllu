import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentMethodInput } from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { companyId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  listActive(companyId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  create(companyId: string, input: PaymentMethodInput) {
    return this.prisma.paymentMethod.create({
      data: {
        companyId,
        ...this.fields(input),
      },
    });
  }

  async update(companyId: string, id: string, input: PaymentMethodInput) {
    await this.owned(companyId, id);
    return this.prisma.paymentMethod.update({
      where: { id },
      data: this.fields(input),
    });
  }

  async remove(companyId: string, id: string) {
    await this.owned(companyId, id);
    await this.prisma.paymentMethod.delete({ where: { id } });
    return { ok: true };
  }

  private async owned(companyId: string, id: string) {
    const existing = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Método de pago no encontrado");
    }
    return existing;
  }

  private fields(input: PaymentMethodInput) {
    return {
      type: input.type,
      name: input.name.trim(),
      isActive: input.isActive ?? false,
      bank: input.bank?.trim() || null,
      accountType: input.accountType?.trim() || null,
      accountNumber: input.accountNumber?.trim() || null,
      accountHolder: input.accountHolder?.trim() || null,
      holderId: input.holderId?.trim() || null,
      receiptEmail: input.receiptEmail?.trim() || null,
      paymentUrl: input.paymentUrl || null,
      notes: input.notes?.trim() || null,
    };
  }
}
