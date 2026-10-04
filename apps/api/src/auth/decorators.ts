import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { AuthUser, TenantContext } from "../common/types";

export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    return ctx.switchToHttp().getRequest().tenant;
  },
);
