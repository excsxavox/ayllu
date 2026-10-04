import { Body, Controller, Get, Post, SetMetadata } from "@nestjs/common";
import {
  createCompanySchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "@aylluu/shared";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthUser } from "../common/types";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("auth/register")
  register(@Body(new ZodValidationPipe(registerSchema)) body: unknown) {
    return this.auth.register(body as never);
  }

  @Public()
  @Post("auth/login")
  login(@Body(new ZodValidationPipe(loginSchema)) body: unknown) {
    return this.auth.login(body as never);
  }

  @Public()
  @Post("auth/refresh")
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @SetMetadata("skipTenant", true)
  @Get("auth/me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @SetMetadata("skipTenant", true)
  @Post("companies")
  createCompany(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCompanySchema)) body: unknown,
  ) {
    return this.auth.createCompany(
      user.id,
      body as never,
      user.platformRole === "PLATFORM_ADMIN",
    );
  }
}
