import type { RequestHandler } from "express";
import type { TenantRole } from "@prisma/client";
import { forbidden } from "../utils/errors.js";
import { authMiddleware } from "./auth.js";
import { tenantMiddleware } from "./tenant.js";

export function requireRole(...roles: TenantRole[]): RequestHandler {
  return (req, _res, next) => {
    const role = req.membership?.role;

    if (!role || !roles.includes(role)) {
      next(forbidden("Your tenant role cannot perform this action"));
      return;
    }

    next();
  };
}

export function requireTenantRole(...roles: TenantRole[]): RequestHandler[] {
  return [authMiddleware, tenantMiddleware, requireRole(...roles)];
}
