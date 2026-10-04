import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { CreateCompanyInput, InviteMemberInput, LoginInput, RegisterInput, UpdateMemberRoleInput } from "@aylluu/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ensureCompanyMessaging } from "../channels/defaults";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }

  async register(input: RegisterInput) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException("El email ya está registrado");

    const userCount = await this.prisma.user.count();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash,
          platformRole: userCount === 0 ? "PLATFORM_ADMIN" : "USER",
        },
      });

      let company = null;
      if (input.companyName) {
        const base = this.slugify(input.companyName) || "empresa";
        let slug = base;
        let i = 1;
        while (await tx.company.findUnique({ where: { slug } })) {
          slug = `${base}-${i++}`;
        }
        company = await tx.company.create({
          data: { name: input.companyName, slug },
        });
        await tx.membership.create({
          data: { userId: user.id, companyId: company.id, role: "COMPANY_ADMIN" },
        });
      }

      return { user, company };
    });

    if (result.company) {
      await ensureCompanyMessaging(this.prisma, result.company.id);
    }

    await this.audit.log({
      userId: result.user.id,
      companyId: result.company?.id,
      action: "auth.register",
      entity: "User",
      entityId: result.user.id,
    });

    return this.issueTokens(result.user.id, result.company?.id);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return this.issueTokens(user.id, membership?.companyId);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ?: string }>(
        refreshToken,
        { secret: this.config.getOrThrow("JWT_REFRESH_SECRET") },
      );
      if (payload.typ !== "refresh") throw new UnauthorizedException();
      return this.issueTokens(payload.sub);
    } catch {
      throw new UnauthorizedException("Refresh token inválido");
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { company: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
      companies: user.memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        slug: m.company.slug,
        role: m.role,
        timezone: m.company.timezone,
        bookingsEnabled: m.company.bookingsEnabled,
      })),
    };
  }

  async createCompany(userId: string, input: CreateCompanyInput, isPlatformAdmin: boolean) {
    const base = input.slug ?? this.slugify(input.name) ?? "empresa";
    let slug = base;
    let i = 1;
    while (await this.prisma.company.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    const company = await this.prisma.company.create({
      data: {
        name: input.name,
        slug,
        timezone: input.timezone ?? "America/Lima",
        memberships: isPlatformAdmin
          ? undefined
          : { create: { userId, role: "COMPANY_ADMIN" } },
      },
    });
    if (isPlatformAdmin) {
      await this.prisma.membership.upsert({
        where: { userId_companyId: { userId, companyId: company.id } },
        update: {},
        create: { userId, companyId: company.id, role: "COMPANY_ADMIN" },
      });
    }
    await ensureCompanyMessaging(this.prisma, company.id);
    await this.audit.log({
      userId,
      companyId: company.id,
      action: "company.create",
      entity: "Company",
      entityId: company.id,
    });
    return company;
  }

  listCompanyMembers(companyId: string) {
    return this.prisma.membership.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, platformRole: true } },
      },
    });
  }

  async addCompanyMember(actorId: string, companyId: string, input: InviteMemberInput) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Empresa no encontrada");
    const email = input.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!input.password) {
        throw new BadRequestException("La cuenta nueva necesita una contraseña.");
      }
      user = await this.prisma.user.create({
        data: {
          email,
          name: input.name.trim(),
          passwordHash: await bcrypt.hash(input.password, 12),
        },
      });
    }
    const already = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (already) throw new ConflictException("Esa persona ya está en la empresa.");
    const row = await this.prisma.membership.create({
      data: { userId: user.id, companyId, role: input.role },
    });
    await this.audit.log({
      userId: actorId,
      companyId,
      action: "member.add",
      entity: "Membership",
      entityId: row.id,
      payload: { email, role: input.role },
    });
    return this.listCompanyMembers(companyId);
  }

  async updateCompanyMember(actorId: string, companyId: string, membershipId: string, input: UpdateMemberRoleInput) {
    const row = await this.prisma.membership.findFirst({ where: { id: membershipId, companyId } });
    if (!row) throw new NotFoundException("Persona no encontrada");
    if (row.role === "COMPANY_ADMIN" && input.role !== "COMPANY_ADMIN") {
      const admins = await this.prisma.membership.count({ where: { companyId, role: "COMPANY_ADMIN" } });
      if (admins <= 1) throw new BadRequestException("Deja al menos un administrador de empresa.");
    }
    await this.prisma.membership.update({ where: { id: membershipId }, data: { role: input.role } });
    await this.audit.log({
      userId: actorId,
      companyId,
      action: "member.role",
      entity: "Membership",
      entityId: membershipId,
      payload: { role: input.role },
    });
    return this.listCompanyMembers(companyId);
  }

  async removeCompanyMember(actorId: string, companyId: string, membershipId: string) {
    const row = await this.prisma.membership.findFirst({ where: { id: membershipId, companyId } });
    if (!row) throw new NotFoundException("Persona no encontrada");
    if (row.role === "COMPANY_ADMIN") {
      const admins = await this.prisma.membership.count({ where: { companyId, role: "COMPANY_ADMIN" } });
      if (admins <= 1) throw new BadRequestException("No puedes quitar al último administrador de empresa.");
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.audit.log({
      userId: actorId,
      companyId,
      action: "member.remove",
      entity: "Membership",
      entityId: membershipId,
    });
    return this.listCompanyMembers(companyId);
  }

  private async issueTokens(userId: string, defaultCompanyId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, typ: "refresh" },
      {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: "30d",
      },
    );
    return {
      accessToken,
      refreshToken,
      defaultCompanyId: defaultCompanyId ?? null,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
      },
    };
  }
}
