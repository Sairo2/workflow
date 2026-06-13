import { AuditAction } from "@prisma/client";
import { prisma } from "../config/database.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import type { CreateDelegationInput } from "../validators/delegationSchema.js";

function delegationPayload(delegation: {
  id: string;
  validFrom: Date;
  validTo: Date;
  revokedAt: Date | null;
  createdAt: Date;
  delegate: { id: string; name: string; email: string };
}) {
  return {
    id: delegation.id,
    validFrom: delegation.validFrom,
    validTo: delegation.validTo,
    revokedAt: delegation.revokedAt,
    createdAt: delegation.createdAt,
    delegate: delegation.delegate
  };
}

const delegationInclude = {
  delegate: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
};

export async function listOutgoingDelegations(tenantId: string, userId: string) {
  const delegations = await prisma.delegation.findMany({
    where: {
      tenantId,
      delegatorId: userId
    },
    include: delegationInclude,
    orderBy: { createdAt: "desc" }
  });

  return delegations.map(delegationPayload);
}

export async function createDelegation(
  tenantId: string,
  actorUserId: string,
  input: CreateDelegationInput
) {
  if (input.delegateId === actorUserId) {
    throw badRequest("SELF_DELEGATION_NOT_ALLOWED", "You cannot delegate approval authority to yourself");
  }

  const delegateMembership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId: input.delegateId
      }
    },
    select: { id: true }
  });

  if (!delegateMembership) {
    throw badRequest("DELEGATE_NOT_IN_TENANT", "Delegate must be a member of this tenant");
  }

  const delegation = await prisma.$transaction(async (tx) => {
    const createdDelegation = await tx.delegation.create({
      data: {
        tenantId,
        delegatorId: actorUserId,
        delegateId: input.delegateId,
        validFrom: input.validFrom,
        validTo: input.validTo
      },
      include: delegationInclude
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: AuditAction.DELEGATION_CREATED,
        entityType: "delegation",
        entityId: createdDelegation.id,
        metadata: {
          delegateId: input.delegateId,
          validFrom: input.validFrom,
          validTo: input.validTo
        }
      }
    });

    return createdDelegation;
  });

  return delegationPayload(delegation);
}

export async function revokeDelegation(tenantId: string, actorUserId: string, delegationId: string) {
  const delegation = await prisma.delegation.findFirst({
    where: {
      id: delegationId,
      tenantId
    }
  });

  if (!delegation) {
    throw notFound("Delegation not found");
  }

  if (delegation.delegatorId !== actorUserId) {
    throw forbidden("You can only revoke your own outgoing delegations");
  }

  if (delegation.revokedAt) {
    const existing = await prisma.delegation.findUniqueOrThrow({
      where: { id: delegation.id },
      include: delegationInclude
    });

    return delegationPayload(existing);
  }

  const revokedAt = new Date();
  const revoked = await prisma.$transaction(async (tx) => {
    const updatedDelegation = await tx.delegation.update({
      where: { id: delegation.id },
      data: { revokedAt },
      include: delegationInclude
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: AuditAction.DELEGATION_REVOKED,
        entityType: "delegation",
        entityId: delegation.id,
        metadata: {
          delegateId: delegation.delegateId,
          revokedAt
        }
      }
    });

    return updatedDelegation;
  });

  return delegationPayload(revoked);
}
