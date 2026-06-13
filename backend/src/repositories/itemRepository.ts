import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

export async function countItems(tenantId: string, where: Prisma.ItemWhereInput) {
  return prisma.item.count({
    where: {
      ...where,
      tenantId
    }
  });
}

export async function findItems(
  tenantId: string,
  where: Prisma.ItemWhereInput,
  pagination: { skip: number; limit: number }
) {
  return prisma.item.findMany({
    where: {
      ...where,
      tenantId
    },
    include: {
      currentState: true,
      workflowVersion: {
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              slug: true,
              slaDurationMinutes: true
            }
          }
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.limit
  });
}

export async function findItemById(tenantId: string, itemId: string) {
  return prisma.item.findFirst({
    where: {
      id: itemId,
      tenantId
    },
    include: {
      currentState: true,
      workflowVersion: {
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              slug: true,
              slaDurationMinutes: true
            }
          },
          states: { orderBy: { position: "asc" } },
          transitions: { orderBy: { createdAt: "asc" } }
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      approvalRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          transition: true,
          approvals: {
            include: {
              assignedApprover: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              decidedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: "asc" }
          }
        }
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 25
      }
    }
  });
}
