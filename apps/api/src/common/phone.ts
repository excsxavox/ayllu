import { BadRequestException } from "@nestjs/common";

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function assertPhone(raw: string): string {
  const phone = normalizePhone(raw);
  if (phone.length < 7 || phone.length > 15) {
    throw new BadRequestException("Teléfono inválido. Usa el número con código de país.");
  }
  return phone;
}
