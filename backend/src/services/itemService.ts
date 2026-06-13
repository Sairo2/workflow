import {
  ApprovalRequestStatus,
  ApprovalStatus,
  ApprovalStrategy,
  AuditAction,
  Prisma,
  TenantRole
} from "@prisma/client";
import { prisma } from "../config/database.js";
import * as itemRepository from "../repositories/itemRepository.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import type { CreateItemInput, ItemListQuery, TransitionItemInput } from "../validators/itemSchema.js";

type ItemWithRelations = NonNullable<Awaited<ReturnType<typeof itemRepository.findItemById>>>;

function itemSummaryPayload(item: Awaited<ReturnType<typeof itemRepository.findItems>>[number]) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    version: item.version,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    currentState: {
      id: item.currentState.id,
      key: item.currentState.key,
      name: item.currentState.name,
      isFinal: item.currentState.isFinal
    },
    workflow: {
      id: item.workflowVersion.workflow.id,
      name: item.workflowVersion.workflow.name,
      slug: item.workflowVersion.workflow.slug,
      versionId: item.workflowVersionId,
      slaDurationMinutes: item.workflowVersion.workflow.slaDurationMinutes
    },
    createdBy: item.createdBy
  };
}

function itemDetailPayload(item: ItemWithRelations) {
  const stateKeyById = new Map(item.workflowVersion.states.map((state) => [state.id, state.key]));

  return {
    ...itemSummaryPayload(item),
    availableTransitions: item.workflowVersion.transitions
      .filter((transition) => transition.fromStateId === item.currentStateId)
      .map((transition) => ({
        id: transition.id,
        toStateId: transition.toStateId,
        toStateKey: stateKeyById.get(transition.toStateId) ?? null,
        name: transition.name,
        requiresApproval: transition.requiresApproval,
        approvalStrategy: transition.approvalStrategy,
        approverRole: transition.approverRole
      })),
    approvalRequests: item.approvalRequests.map((request) => ({
      id: request.id,
      status: request.status,
      transitionId: request.transitionId,
      itemVersion: request.itemVersion,
      createdAt: request.createdAt,
      resolvedAt: request.resolvedAt,
      approvals: request.approvals.map((approval) => ({
        id: approval.id,
        status: approval.status,
        assignedApprover: approval.assignedApprover,
        decidedBy: approval.decidedBy,
        decidedAt: approval.decidedAt,
        comment: approval.comment
      }))
    })),
    auditLogs: item.auditLogs
  };
}

async function getInitialState(tenantId: string, workflowVersionId: string) {
  const workflowVersion = await prisma.workflowVersion.findFirst({
    where: {
      id: workflowVersionId,
      tenantId
    },
    include: {
      states: {
        where: { isInitial: true }
      }
    }
  });

  if (!workflowVersion) {
    throw notFound("Workflow version not found");
  }

  const initialState = workflowVersion.states[0];

  if (!initialState) {
    throw badRequest("WORKFLOW_HAS_NO_INITIAL_STATE", "Workflow version has no initial state");
  }

  return initialState;
}

function assertApprovalStrategySupported(strategy: ApprovalStrategy | null) {
  if (strategy === ApprovalStrategy.QUORUM) {
    throw badRequest("QUORUM_NOT_IMPLEMENTED", "Quorum approvals are modeled but not implemented yet");
  }
}

function approvalSatisfied(
  strategy: ApprovalStrategy | null,
  approvals: Array<{ status: ApprovalStatus }>
) {
  assertApprovalStrategySupported(strategy);

  if (approvals.some((approval) => approval.status === ApprovalStatus.REJECTED)) {
    throw forbidden("Approval was rejected for this transition");
  }

  if (strategy === ApprovalStrategy.ALL) {
    return approvals.length > 0 && approvals.every((approval) => approval.status === ApprovalStatus.APPROVED);
  }

  return approvals.some((approval) => approval.status === ApprovalStatus.APPROVED);
}

async function getApproverIds(tenantId: string, role: TenantRole | null) {
  if (!role) {
    throw badRequest("APPROVER_ROLE_REQUIRED", "Transition requires an approver role");
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId,
      role
    },
    select: {
      userId: true
    }
  });

  return memberships.map((membership) => membership.userId);
}

export async function listItems(tenantId: string, query: ItemListQuery) {
  const where: Prisma.ItemWhereInput = {};

  if (query.workflowVersionId) {
    where.workflowVersionId = query.workflowVersionId;
  }

  if (query.state) {
    where.currentState = {
      key: query.state
    };
  }

  const pagination = {
    page: query.page,
    limit: query.limit,
    skip: (query.page - 1) * query.limit
  };

  const [total, items] = await Promise.all([
    itemRepository.countItems(tenantId, where),
    itemRepository.findItems(tenantId, where, pagination)
  ]);

  return {
    data: items.map(itemSummaryPayload),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      hasNextPage: pagination.skip + items.length < total
    }
  };
}

export async function getItem(tenantId: string, itemId: string) {
  const item = await itemRepository.findItemById(tenantId, itemId);

  if (!item) {
    throw notFound("Item not found");
  }

  return itemDetailPayload(item);
}

export async function createItem(tenantId: string, actorUserId: string, input: CreateItemInput) {
  const initialState = await getInitialState(tenantId, input.workflowVersionId);

  const item = await prisma.$transaction(async (tx) => {
    const createdItem = await tx.item.create({
      data: {
        tenantId,
        workflowVersionId: input.workflowVersionId,
        currentStateId: initialState.id,
        createdById: actorUserId,
        title: input.title,
        description: input.description
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        itemId: createdItem.id,
        action: AuditAction.ITEM_CREATED,
        entityType: "item",
        entityId: createdItem.id,
        metadata: {
          title: createdItem.title,
          stateId: initialState.id
        }
      }
    });

    return createdItem;
  });

  return getItem(tenantId, item.id);
}

export async function transitionItem(
  tenantId: string,
  actorUserId: string,
  itemId: string,
  input: TransitionItemInput
) {
  let satisfiedApprovalRequestId: string | null = null;

  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      tenantId
    },
    include: {
      workflowVersion: true,
      currentState: true
    }
  });

  if (!item) {
    throw notFound("Item not found");
  }

  if (item.version !== input.currentVersion) {
    throw conflict("ITEM_VERSION_CONFLICT", "Item was changed by another request", {
      expectedVersion: item.version,
      providedVersion: input.currentVersion
    });
  }

  const transition = await prisma.workflowTransition.findFirst({
    where: {
      tenantId,
      workflowVersionId: item.workflowVersionId,
      fromStateId: item.currentStateId,
      toStateId: input.toStateId
    }
  });

  if (!transition) {
    throw badRequest("INVALID_TRANSITION", "Requested transition is not valid from the current state");
  }

  if (transition.requiresApproval) {
    const existingRequest = await prisma.approvalRequest.findFirst({
      where: {
        tenantId,
        itemId,
        transitionId: transition.id,
        itemVersion: item.version,
        status: {
          in: [ApprovalRequestStatus.PENDING, ApprovalRequestStatus.APPROVED, ApprovalRequestStatus.REJECTED]
        }
      },
      include: {
        approvals: true
      },
      orderBy: { createdAt: "desc" }
    });

    if (!existingRequest) {
      assertApprovalStrategySupported(transition.approvalStrategy);

      const approverIds = await getApproverIds(tenantId, transition.approverRole);

      if (approverIds.length === 0) {
        throw badRequest("NO_APPROVERS_AVAILABLE", "No users are available for this approval role");
      }

      const request = await prisma.$transaction(async (tx) => {
        const createdRequest = await tx.approvalRequest.create({
          data: {
            tenantId,
            itemId,
            transitionId: transition.id,
            requestedById: actorUserId,
            itemVersion: item.version,
            idempotencyKey: input.idempotencyKey
          }
        });

        await tx.approval.createMany({
          data: approverIds.map((approverId) => ({
            tenantId,
            approvalRequestId: createdRequest.id,
            assignedApproverId: approverId
          }))
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            actorUserId,
            itemId,
            action: AuditAction.TRANSITION_REQUESTED,
            entityType: "approval_request",
            entityId: createdRequest.id,
            metadata: {
              fromStateId: item.currentStateId,
              toStateId: transition.toStateId,
              transitionId: transition.id
            }
          }
        });

        return createdRequest;
      });

      throw forbidden("Approval required before this transition can be completed", {
        approvalRequestId: request.id
      });
    }

    if (!approvalSatisfied(transition.approvalStrategy, existingRequest.approvals)) {
      throw forbidden("Approval is still pending for this transition", {
        approvalRequestId: existingRequest.id
      });
    }

    satisfiedApprovalRequestId = existingRequest.id;
  }

  const updatedItem = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.item.updateMany({
      where: {
        id: item.id,
        tenantId,
        version: input.currentVersion,
        currentStateId: item.currentStateId
      },
      data: {
        currentStateId: transition.toStateId,
        version: { increment: 1 }
      }
    });

    if (updateResult.count === 0) {
      throw conflict("ITEM_VERSION_CONFLICT", "Item was changed by another request");
    }

    if (satisfiedApprovalRequestId) {
      await tx.approvalRequest.update({
        where: { id: satisfiedApprovalRequestId },
        data: {
          status: ApprovalRequestStatus.APPROVED,
          resolvedAt: new Date()
        }
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        itemId,
        action: AuditAction.ITEM_TRANSITIONED,
        entityType: "item",
        entityId: item.id,
        metadata: {
          fromStateId: item.currentStateId,
          toStateId: transition.toStateId,
          transitionId: transition.id,
          previousVersion: input.currentVersion,
          nextVersion: input.currentVersion + 1
        }
      }
    });

    return tx.item.findUniqueOrThrow({
      where: { id: item.id }
    });
  });

  return getItem(tenantId, updatedItem.id);
}
