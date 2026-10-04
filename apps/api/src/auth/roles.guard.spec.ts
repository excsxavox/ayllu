import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function ctx(user: unknown, tenant?: unknown) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, tenant }),
    }),
  } as never;
}

describe("RolesGuard — extra de reservas", () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(["PLATFORM_ADMIN"]),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it("deja pasar al administrador de AYLLUU", () => {
    expect(guard.canActivate(ctx({ platformRole: "PLATFORM_ADMIN" }))).toBe(true);
  });

  it("impide que el admin de la empresa active el plan", () => {
    expect(() =>
      guard.canActivate(ctx({ platformRole: "USER" }, { role: "COMPANY_ADMIN" })),
    ).toThrow(ForbiddenException);
  });
});
