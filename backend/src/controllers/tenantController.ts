import type { Request, Response } from "express";
import { prisma } from "../config/database.js";

export async function listMyTenants(req: Request, res: Response) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: req.user?.id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: { tenant: { name: "asc" } }
  });

  res.json({
    data: memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      role: membership.role
    }))
  });
}
