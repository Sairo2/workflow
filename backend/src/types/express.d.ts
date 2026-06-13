import type { TenantRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
      tenant?: {
        id: string;
        name: string;
        slug: string;
      };
      membership?: {
        role: TenantRole;
        tenantId: string;
        userId: string;
      };
    }
  }
}

export {};
