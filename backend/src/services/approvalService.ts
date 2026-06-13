import {
  ApprovalRequestStatus,
  ApprovalStatus,
  ApprovalStrategy,
  AuditAction,
  type Prisma
} from "@prisma/client";
import { prisma } from "../config/database.js";
import { conflict, forbidden, notFound } from "../utils/errors.js";
import type { ApprovalDecisionInput } from "../validators/approvalSchema.js";

type ApprovalDecision = "APPROVED" | "REJECTED";

function approvalPayload(approval: {
  id: string;
  status: ApprovalStatus;
  comment: string | null;
  decidedAt: Date | null;
  assignedApprover: { id: string; name: string; email: string };
  decidedBy: { id: string; name: string; email: string } | null;
  approvalRequest: {
    id: string;
    status: ApprovalRequestStatus;
    itemVersion: number;
    item: {
      id: string;
      title: string;
      version: number;
      currentState: { id: string; key: string; name: string };
    };
    transition: {
      id: string;
      name: string;
      approvalStrategy: ApprovalStrategy | null;
      fromState: { id: string; key: string; name: string };
      toState: { id: string; key: string; name: string };
    };
  };
}) {
  return {
    id: approval.id,
    status: approval.status,
    comment: approval.comment,
    decidedAt: approval.decidedAt,
    assignedApprover: approval.assignedApprover,
    decidedBy: approval.decidedBy,
    approvalRequest: {
      id: approval.approvalRequest.id,
      status: approval.approvalRequest.status,
      itemVersion: approval.approvalRequest.itemVersion,
      item: approval.approvalRequest.item,
      transition: approval.approvalRequest.transition
    }
  };
}

function evaluateApprovalRequest(
  strategy: ApprovalStrategy | null,
  approvals: Array<{ status: ApprovalStatus }>
) {
  if (approvals.some((approval) => approval.status === ApprovalStatus.REJECTED)) {
    return ApprovalRequestStatus.REJECTED;
  }

  if (strategy === ApprovalStrategy.ALL) {
    return approvals.every((approval) => approval.status === ApprovalStatus.APPROVED)
      ? ApprovalRequestStatus.APPROVED
      : ApprovalRequestStatus.PENDING;
  }

  // QUORUM is intentionally treated as SINGLE for this assignment slice.
  return approvals.some((approval) => approval.status === ApprovalStatus.APPROVED)
    ? ApprovalRequestStatus.APPROVED
    : ApprovalRequestStatus.PENDING;
}

async function lockItem(tx: Prisma.TransactionClient, tenantId: string, itemId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM items
    WHERE id = ${itemId}::uuid
      AND tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw notFound("Item not found");
  }
}

async function lockApproval(tx: Prisma.TransactionClient, tenantId: string, approvalId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM approvals
    WHERE id = ${approvalId}::uuid
      AND tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw notFound("Approval not found");
  }
}

async function hasActiveDelegation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  assignedApproverId: string,
  delegateId: string,
  now: Date
) {
  const delegation = await tx.delegation.findFirst({
    where: {
      tenantId,
      delegatorId: assignedApproverId,
      delegateId,
      revokedAt: null,
      validFrom: { lte: now },
      validTo: { gte: now }
    },
    select: { id: true }
  });

  return Boolean(delegation);
}

export async function listPendingApprovals(tenantId: string, userId: string) {
  const now = new Date();
  const approvals = await prisma.approval.findMany({
    where: {
      tenantId,
      status: ApprovalStatus.PENDING,
      approvalRequest: {
        status: ApprovalRequestStatus.PENDING
      },
      OR: [
        { assignedApproverId: userId },
        {
          assignedApprover: {
            outgoingDelegations: {
              some: {
                tenantId,
                delegateId: userId,
                revokedAt: null,
                validFrom: { lte: now },
                validTo: { gte: now }
              }
            }
          }
        }
      ]
    },
    include: {
      assignedApprover: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
      approvalRequest: {
        include: {
          item: {
            select: {
              id: true,
              title: true,
              version: true,
              currentState: { select: { id: true, key: true, name: true } }
            }
          },
          transition: {
            include: {
              fromState: { select: { id: true, key: true, name: true } },
              toState: { select: { id: true, key: true, name: true } }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return approvals.map(approvalPayload);
}

export async function decideApproval(
  tenantId: string,
  actorUserId: string,
  approvalId: string,
  decision: ApprovalDecision,
  input: ApprovalDecisionInput
) {
  const approvalLookup = await prisma.approval.findFirst({
    where: { id: approvalId, tenantId },
    select: {
      id: true,
      assignedApproverId: true,
      approvalRequest: {
        select: {
          itemId: true
        }
      }
    }
  });

  if (!approvalLookup) {
    throw notFound("Approval not found");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await lockItem(tx, tenantId, approvalLookup.approvalRequest.itemId);
    await lockApproval(tx, tenantId, approvalId);

    const approval = await tx.approval.findFirst({
      where: { id: approvalId, tenantId },
      include: {
        approvalRequest: {
          include: {
            transition: true,
            approvals: true
          }
        }
      }
    });

    if (!approval) {
      throw notFound("Approval not found");
    }

    const isAssignedApprover = approval.assignedApproverId === actorUserId;
    const isDelegate = isAssignedApprover
      ? false
      : await hasActiveDelegation(tx, tenantId, approval.assignedApproverId, actorUserId, now);

    if (!isAssignedApprover && !isDelegate) {
      throw forbidden("You cannot decide this approval");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      if (approval.status === decision) {
        return approvalPayload(
          await tx.approval.findUniqueOrThrow({
            where: { id: approval.id },
            include: approvalResponseInclude
          })
        );
      }

      throw conflict("APPROVAL_ALREADY_DECIDED", "Approval has already been decided", {
        currentStatus: approval.status,
        requestedStatus: decision
      });
    }

    await tx.approval.update({
      where: { id: approval.id },
      data: {
        status: decision,
        decidedById: actorUserId,
        decidedAt: now,
        comment: input.comment
      }
    });

    const approvalsAfterDecision = approval.approvalRequest.approvals.map((row) =>
      row.id === approval.id ? { ...row, status: decision } : row
    );
    const requestStatus = evaluateApprovalRequest(
      approval.approvalRequest.transition.approvalStrategy,
      approvalsAfterDecision
    );

    await tx.approvalRequest.update({
      where: { id: approval.approvalRequestId },
      data: {
        status: requestStatus,
        resolvedAt:
          requestStatus === ApprovalRequestStatus.PENDING
            ? null
            : now
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        itemId: approval.approvalRequest.itemId,
        action:
          decision === ApprovalStatus.APPROVED
            ? AuditAction.APPROVAL_APPROVED
            : AuditAction.APPROVAL_REJECTED,
        entityType: "approval",
        entityId: approval.id,
        metadata: {
          approvalRequestId: approval.approvalRequestId,
          assignedApproverId: approval.assignedApproverId,
          decidedAsDelegate: isDelegate,
          requestStatus
        }
      }
    });

    return approvalPayload(
      await tx.approval.findUniqueOrThrow({
        where: { id: approval.id },
        include: approvalResponseInclude
      })
    );
  });
}

const approvalResponseInclude = {
  assignedApprover: { select: { id: true, name: true, email: true } },
  decidedBy: { select: { id: true, name: true, email: true } },
  approvalRequest: {
    include: {
      item: {
        select: {
          id: true,
          title: true,
          version: true,
          currentState: { select: { id: true, key: true, name: true } }
        }
      },
      transition: {
        include: {
          fromState: { select: { id: true, key: true, name: true } },
          toState: { select: { id: true, key: true, name: true } }
        }
      }
    }
  }
} satisfies Prisma.ApprovalInclude;
