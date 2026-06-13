import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

type BreachedItemRow = {
  id: string;
  tenant_id: string;
  workflow_version_id: string;
  current_state_id: string;
  title: string;
  created_at: Date;
  sla_duration_minutes: number;
};

function tenantFilter(tenantId?: string) {
  return tenantId
    ? Prisma.sql`AND i.tenant_id = ${tenantId}::uuid`
    : Prisma.empty;
}

export async function detectSlaBreaches(tenantId?: string) {
  const breachedItems = await prisma.$queryRaw<BreachedItemRow[]>`
    SELECT
      i.id,
      i.tenant_id,
      i.workflow_version_id,
      i.current_state_id,
      i.title,
      i.created_at,
      w.sla_duration_minutes
    FROM items i
    JOIN workflow_versions wv ON wv.id = i.workflow_version_id
    JOIN workflows w ON w.id = wv.workflow_id
    JOIN workflow_states ws ON ws.id = i.current_state_id
    WHERE i.sla_breached_at IS NULL
      AND w.sla_duration_minutes IS NOT NULL
      AND ws.is_final = false
      AND i.created_at + (w.sla_duration_minutes * INTERVAL '1 minute') <= NOW()
      ${tenantFilter(tenantId)}
    ORDER BY i.created_at ASC
  `;

  const processed = [];

  for (const item of breachedItems) {
    const breachedAt = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.item.updateMany({
        where: {
          id: item.id,
          tenantId: item.tenant_id,
          slaBreachedAt: null
        },
        data: {
          slaBreachedAt: breachedAt
        }
      });

      if (updateResult.count === 0) {
        return null;
      }

      await tx.auditLog.create({
        data: {
          tenantId: item.tenant_id,
          itemId: item.id,
          action: AuditAction.SLA_BREACHED,
          entityType: "item",
          entityId: item.id,
          metadata: {
            title: item.title,
            createdAt: item.created_at,
            breachedAt,
            slaDurationMinutes: item.sla_duration_minutes,
            workflowVersionId: item.workflow_version_id,
            currentStateId: item.current_state_id
          }
        }
      });

      return {
        itemId: item.id,
        tenantId: item.tenant_id,
        breachedAt,
        slaDurationMinutes: item.sla_duration_minutes
      };
    });

    if (updated) {
      processed.push(updated);
    }
  }

  return {
    checkedAt: new Date(),
    breachedCount: processed.length,
    breachedItems: processed
  };
}
