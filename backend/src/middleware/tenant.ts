import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database.js";
import { badRequest, forbidden, unauthorized } from "../utils/errors.js";

export async function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const tenantId = req.header("X-Tenant-ID");

  if (!tenantId) {
    next(badRequest("TENANT_HEADER_REQUIRED", "X-Tenant-ID header is required"));
    return;
  }

  if (!req.user) {
    next(unauthorized());
    return;
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId: req.user.id } },
    include: { tenant: { select: { id: true, name: true, slug: true } } }
  });

  if (!membership) {
    next(forbidden("You are not a member of this tenant"));
    return;
  }

  req.tenant = membership.tenant;
  req.membership = {
    role: membership.role,
    tenantId: membership.tenantId,
    userId: membership.userId
  };
  next();
}
