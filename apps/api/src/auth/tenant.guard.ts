import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC } from "./decorators";
import { AuthUser } from "../common/types";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) return true;

    const skipTenant = this.reflector.getAllAndOverride<boolean>("skipTenant", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipTenant) return true;

    const companyId = (req.headers["x-company-id"] as string | undefined)?.trim();
    if (!companyId) {
      if (user.platformRole === "PLATFORM_ADMIN") return true;
      throw new ForbiddenException("Header X-Company-Id requerido");
    }

    if (user.platformRole === "PLATFORM_ADMIN") {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new ForbiddenException("Empresa no encontrada");
      req.tenant = { companyId, role: "PLATFORM_ADMIN" };
      return true;
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (!membership) throw new ForbiddenException("Sin acceso a esta empresa");

    req.tenant = { companyId, role: membership.role };
    return true;
  }
}
