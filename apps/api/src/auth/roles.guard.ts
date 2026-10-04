import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MembershipRole, PlatformRole } from "@prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Array<MembershipRole | PlatformRole>) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Array<MembershipRole | PlatformRole>>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const tenant = req.tenant;
    if (user?.platformRole === "PLATFORM_ADMIN") return true;
    if (roles.includes(user?.platformRole)) return true;
    if (tenant && roles.includes(tenant.role)) return true;
    throw new ForbiddenException("Permisos insuficientes");
  }
}
