import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

export type WorkflowCreateData = Prisma.WorkflowCreateInput;

export async function countWorkflows(tenantId: string, where: Prisma.WorkflowWhereInput) {
  return prisma.workflow.count({
    where: {
      ...where,
      tenantId
    }
  });
}

export async function findWorkflows(
  tenantId: string,
  where: Prisma.WorkflowWhereInput,
  pagination: { skip: number; limit: number }
) {
  return prisma.workflow.findMany({
    where: {
      ...where,
      tenantId
    },
    include: {
      activeVersion: {
        include: {
          states: { orderBy: { position: "asc" } },
          transitions: { orderBy: { createdAt: "asc" } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.limit
  });
}

export async function findWorkflowById(tenantId: string, workflowId: string) {
  return prisma.workflow.findFirst({
    where: {
      id: workflowId,
      tenantId
    },
    include: {
      activeVersion: {
        include: {
          states: { orderBy: { position: "asc" } },
          transitions: { orderBy: { createdAt: "asc" } }
        }
      }
    }
  });
}

export async function findWorkflowVersionHistory(tenantId: string, workflowId: string) {
  return prisma.workflowVersion.findMany({
    where: {
      tenantId,
      workflowId
    },
    include: {
      states: { orderBy: { position: "asc" } },
      transitions: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { version: "desc" }
  });
}

export async function findWorkflowForClone(tenantId: string, workflowId: string) {
  return prisma.workflow.findFirst({
    where: {
      id: workflowId,
      tenantId
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          states: { orderBy: { position: "asc" } },
          transitions: { orderBy: { createdAt: "asc" } }
        }
      }
    }
  });
}
