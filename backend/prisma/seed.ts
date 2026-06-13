import bcrypt from "bcryptjs";
import {
  ApprovalRequestStatus,
  ApprovalStatus,
  ApprovalStrategy,
  AuditAction,
  PrismaClient,
  TenantRole
} from "@prisma/client";

const prisma = new PrismaClient();

const password = "Password123!";

async function upsertUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash }
  });
}

async function ensureMembership(tenantId: string, userId: string, role: TenantRole) {
  return prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: { role },
    create: { tenantId, userId, role }
  });
}

async function resetSeedData() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs,
      approvals,
      approval_requests,
      delegations,
      items,
      workflow_transitions,
      workflow_states,
      workflow_versions,
      workflows,
      tenant_memberships,
      tenants,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function seedTicketWorkflow(tenantId: string, adminId: string, approverId: string, memberId: string) {
  const workflow = await prisma.workflow.upsert({
    where: { tenantId_slug: { tenantId, slug: "ticket-workflow" } },
    update: { name: "Ticket Workflow", slaDurationMinutes: 60 },
    create: { tenantId, name: "Ticket Workflow", slug: "ticket-workflow", slaDurationMinutes: 60 }
  });

  const version = await prisma.workflowVersion.create({
    data: { tenantId, workflowId: workflow.id, version: 1, isActive: true }
  });

  const stateNew = await prisma.workflowState.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      key: "NEW",
      name: "New",
      position: 1,
      isInitial: true
    }
  });

  const stateInProgress = await prisma.workflowState.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      key: "IN_PROGRESS",
      name: "In Progress",
      position: 2
    }
  });

  const stateDone = await prisma.workflowState.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      key: "DONE",
      name: "Done",
      position: 3,
      isFinal: true
    }
  });

  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id }
  });

  await prisma.workflowTransition.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      fromStateId: stateNew.id,
      toStateId: stateInProgress.id,
      name: "Start work"
    }
  });

  const finishTransition = await prisma.workflowTransition.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      fromStateId: stateInProgress.id,
      toStateId: stateDone.id,
      name: "Mark done",
      requiresApproval: true,
      approvalStrategy: ApprovalStrategy.SINGLE,
      approverRole: TenantRole.APPROVER
    }
  });

  await prisma.item.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      currentStateId: stateNew.id,
      createdById: memberId,
      title: "Item A",
      description: "Initial support ticket waiting to be picked up."
    }
  });

  const itemB = await prisma.item.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      currentStateId: stateInProgress.id,
      createdById: memberId,
      title: "Item B",
      description: "Work is complete, approval is pending."
    }
  });

  const requestB = await prisma.approvalRequest.create({
    data: {
      tenantId,
      itemId: itemB.id,
      transitionId: finishTransition.id,
      requestedById: memberId,
      itemVersion: itemB.version,
      status: ApprovalRequestStatus.PENDING,
      idempotencyKey: "seed-acme-item-b-finish"
    }
  });

  await prisma.approval.create({
    data: {
      tenantId,
      approvalRequestId: requestB.id,
      assignedApproverId: approverId
    }
  });

  const itemC = await prisma.item.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      currentStateId: stateDone.id,
      createdById: memberId,
      title: "Item C",
      description: "Already approved and completed.",
      version: 2
    }
  });

  const requestC = await prisma.approvalRequest.create({
    data: {
      tenantId,
      itemId: itemC.id,
      transitionId: finishTransition.id,
      requestedById: memberId,
      itemVersion: 1,
      status: ApprovalRequestStatus.APPROVED,
      resolvedAt: new Date(),
      idempotencyKey: "seed-acme-item-c-finish"
    }
  });

  await prisma.approval.create({
    data: {
      tenantId,
      approvalRequestId: requestC.id,
      assignedApproverId: approverId,
      decidedById: approverId,
      status: ApprovalStatus.APPROVED,
      decidedAt: new Date(),
      comment: "Looks good."
    }
  });

  await prisma.delegation.create({
    data: {
      tenantId,
      delegatorId: approverId,
      delegateId: memberId,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.auditLog.createMany({
    data: [
      {
        tenantId,
        actorUserId: adminId,
        action: AuditAction.WORKFLOW_CREATED,
        entityType: "workflow",
        entityId: workflow.id,
        metadata: { name: workflow.name }
      },
      {
        tenantId,
        actorUserId: memberId,
        itemId: itemB.id,
        action: AuditAction.TRANSITION_REQUESTED,
        entityType: "approval_request",
        entityId: requestB.id,
        metadata: { transition: finishTransition.name }
      }
    ]
  });
}

async function seedPurchaseWorkflow(tenantId: string, adminId: string, approverId: string) {
  const workflow = await prisma.workflow.upsert({
    where: { tenantId_slug: { tenantId, slug: "purchase-request" } },
    update: { name: "Purchase Request", slaDurationMinutes: 120 },
    create: { tenantId, name: "Purchase Request", slug: "purchase-request", slaDurationMinutes: 120 }
  });

  const version = await prisma.workflowVersion.create({
    data: { tenantId, workflowId: workflow.id, version: 1, isActive: true }
  });

  const draft = await prisma.workflowState.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      key: "DRAFT",
      name: "Draft",
      position: 1,
      isInitial: true
    }
  });

  const review = await prisma.workflowState.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      key: "REVIEW",
      name: "Review",
      position: 2
    }
  });

  const approved = await prisma.workflowState.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      key: "APPROVED",
      name: "Approved",
      position: 3,
      isFinal: true
    }
  });

  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { activeVersionId: version.id }
  });

  await prisma.workflowTransition.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      fromStateId: draft.id,
      toStateId: review.id,
      name: "Submit for review"
    }
  });

  const approveTransition = await prisma.workflowTransition.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      fromStateId: review.id,
      toStateId: approved.id,
      name: "Approve purchase",
      requiresApproval: true,
      approvalStrategy: ApprovalStrategy.ALL,
      approverRole: TenantRole.APPROVER
    }
  });

  const item = await prisma.item.create({
    data: {
      tenantId,
      workflowVersionId: version.id,
      currentStateId: review.id,
      createdById: adminId,
      title: "Renew Postgres monitoring subscription",
      description: "Purchase request waiting for approval."
    }
  });

  const request = await prisma.approvalRequest.create({
    data: {
      tenantId,
      itemId: item.id,
      transitionId: approveTransition.id,
      requestedById: adminId,
      itemVersion: item.version,
      idempotencyKey: "seed-northwind-monitoring-renewal-approve"
    }
  });

  await prisma.approval.create({
    data: {
      tenantId,
      approvalRequestId: request.id,
      assignedApproverId: approverId
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId: adminId,
      itemId: item.id,
      action: AuditAction.ITEM_CREATED,
      entityType: "item",
      entityId: item.id,
      metadata: { title: item.title }
    }
  });
}

async function main() {
  await resetSeedData();

  const [alice, bob, carol, maya, arjun] = await Promise.all([
    upsertUser("alice@acme.com", "Alice Carter"),
    upsertUser("bob@acme.com", "Bob Mehta"),
    upsertUser("carol@acme.com", "Carol Singh"),
    upsertUser("maya@northwind.test", "Maya Rao"),
    upsertUser("arjun@northwind.test", "Arjun Nair")
  ]);

  const acme = await prisma.tenant.upsert({
    where: { slug: "acme" },
    update: { name: "Acme Corp" },
    create: { name: "Acme Corp", slug: "acme" }
  });

  const northwind = await prisma.tenant.upsert({
    where: { slug: "northwind" },
    update: { name: "Northwind Ops" },
    create: { name: "Northwind Ops", slug: "northwind" }
  });

  await Promise.all([
    ensureMembership(acme.id, alice.id, TenantRole.ADMIN),
    ensureMembership(acme.id, bob.id, TenantRole.APPROVER),
    ensureMembership(acme.id, carol.id, TenantRole.MEMBER),
    ensureMembership(northwind.id, maya.id, TenantRole.ADMIN),
    ensureMembership(northwind.id, arjun.id, TenantRole.APPROVER)
  ]);

  await seedTicketWorkflow(acme.id, alice.id, bob.id, carol.id);
  await seedPurchaseWorkflow(northwind.id, maya.id, arjun.id);

  console.log(`Seed complete. Demo password for all users: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
