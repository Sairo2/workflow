import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import type { AuditLogQuery } from "../validators/auditSchema.js";

function auditLogPayload(log: {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  itemId: string | null;
  actor: { id: string; name: string; email: string } | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    itemId: log.itemId,
    actor: log.actor,
    metadata: log.metadata,
    createdAt: log.createdAt
  };
}

export async function listAuditLogs(tenantId: string, query: AuditLogQuery) {
  const where: Prisma.AuditLogWhereInput = {
    tenantId
  };

  if (query.entityType) {
    where.entityType = query.entityType;
  }

  if (query.entityId) {
    where.entityId = query.entityId;
  }

  if (query.itemId) {
    where.itemId = query.itemId;
  }

  const skip = (query.page - 1) * query.limit;
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit
    })
  ]);

  return {
    data: logs.map(auditLogPayload),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      hasNextPage: skip + logs.length < total
    }
  };
}
