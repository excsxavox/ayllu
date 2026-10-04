import { MembershipRole, PlatformRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
};

export type TenantContext = {
  companyId: string;
  role: MembershipRole | "PLATFORM_ADMIN";
};
