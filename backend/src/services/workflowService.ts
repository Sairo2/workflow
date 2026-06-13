import { AuditAction, Prisma, TenantRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import * as workflowRepository from "../repositories/workflowRepository.js";
import { badRequest, notFound } from "../utils/errors.js";
import type {
  CloneWorkflowVersionInput,
  CreateWorkflowInput,
  WorkflowListQuery
} from "../validators/workflowSchema.js";

type StateInput = CreateWorkflowInput["states"][number];
type TransitionInput = CreateWorkflowInput["transitions"][number];

function approverRoleFromStoredRole(role: TenantRole | null): TransitionInput["approverRole"] {
  if (role === TenantRole.ADMIN || role === TenantRole.APPROVER) {
    return role;
  }

  return undefined;
}

function validateWorkflowDefinition(states: StateInput[], transitions: TransitionInput[]) {
  const keys = new Set<string>();
  const positions = new Set<number>();

  for (const state of states) {
    if (keys.has(state.key)) {
      throw badRequest("DUPLICATE_WORKFLOW_STATE", `Duplicate state key: ${state.key}`);
    }

    if (positions.has(state.position)) {
      throw badRequest("DUPLICATE_STATE_POSITION", `Duplicate state position: ${state.position}`);
    }

    keys.add(state.key);
    positions.add(state.position);
  }

  const initialStates = states.filter((state) => state.isInitial);

  if (initialStates.length !== 1) {
    throw badRequest("INVALID_INITIAL_STATE", "Workflow must have exactly one initial state");
  }

  if (!states.some((state) => state.isFinal)) {
    throw badRequest("INVALID_FINAL_STATE", "Workflow must have at least one final state");
  }

  const transitionPairs = new Set<string>();

  for (const transition of transitions) {
    if (!keys.has(transition.fromStateKey)) {
      throw badRequest("UNKNOWN_FROM_STATE", `Unknown from state: ${transition.fromStateKey}`);
    }

    if (!keys.has(transition.toStateKey)) {
      throw badRequest("UNKNOWN_TO_STATE", `Unknown to state: ${transition.toStateKey}`);
    }

    if (transition.fromStateKey === transition.toStateKey) {
      throw badRequest("SELF_TRANSITION_NOT_ALLOWED", "Transition cannot point to the same state");
    }

    const pair = `${transition.fromStateKey}->${transition.toStateKey}`;

    if (transitionPairs.has(pair)) {
      throw badRequest("DUPLICATE_TRANSITION", `Duplicate transition: ${pair}`);
    }

    transitionPairs.add(pair);

    if (!transition.requiresApproval && (transition.approvalStrategy || transition.approverRole)) {
      throw badRequest(
        "APPROVAL_CONFIG_NOT_ALLOWED",
        "Approval strategy and approver role are only valid when approval is required"
      );
    }
  }
}

function versionPayload(version: {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  states: Array<{
    id: string;
    key: string;
    name: string;
    position: number;
    isInitial: boolean;
    isFinal: boolean;
  }>;
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    name: string;
    requiresApproval: boolean;
    approvalStrategy: string | null;
    approverRole: string | null;
    quorumCount: number | null;
  }>;
}) {
  const stateKeyById = new Map(version.states.map((state) => [state.id, state.key]));

  return {
    id: version.id,
    version: version.version,
    isActive: version.isActive,
    createdAt: version.createdAt,
    states: version.states.map((state) => ({
      id: state.id,
      key: state.key,
      name: state.name,
      position: state.position,
      isInitial: state.isInitial,
      isFinal: state.isFinal
    })),
    transitions: version.transitions.map((transition) => ({
      id: transition.id,
      fromStateId: transition.fromStateId,
      fromStateKey: stateKeyById.get(transition.fromStateId) ?? null,
      toStateId: transition.toStateId,
      toStateKey: stateKeyById.get(transition.toStateId) ?? null,
      name: transition.name,
      requiresApproval: transition.requiresApproval,
      approvalStrategy: transition.approvalStrategy,
      approverRole: transition.approverRole,
      quorumCount: transition.quorumCount
    }))
  };
}

function workflowPayload(workflow: {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  slaDurationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  activeVersion: Parameters<typeof versionPayload>[0] | null;
}) {
  return {
    id: workflow.id,
    tenantId: workflow.tenantId,
    name: workflow.name,
    slug: workflow.slug,
    slaDurationMinutes: workflow.slaDurationMinutes,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    activeVersion: workflow.activeVersion ? versionPayload(workflow.activeVersion) : null
  };
}

async function createVersion(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    workflowId: string;
    versionNumber: number;
    isActive: boolean;
    states: StateInput[];
    transitions: TransitionInput[];
  }
) {
  const version = await tx.workflowVersion.create({
    data: {
      tenantId: params.tenantId,
      workflowId: params.workflowId,
      version: params.versionNumber,
      isActive: params.isActive
    }
  });

  const stateRows = await Promise.all(
    params.states.map((state) =>
      tx.workflowState.create({
        data: {
          tenantId: params.tenantId,
          workflowVersionId: version.id,
          key: state.key,
          name: state.name,
          position: state.position,
          isInitial: state.isInitial,
          isFinal: state.isFinal
        }
      })
    )
  );

  const stateIdByKey = new Map(stateRows.map((state) => [state.key, state.id]));

  await Promise.all(
    params.transitions.map((transition) =>
      tx.workflowTransition.create({
        data: {
          tenantId: params.tenantId,
          workflowVersionId: version.id,
          fromStateId: stateIdByKey.get(transition.fromStateKey)!,
          toStateId: stateIdByKey.get(transition.toStateKey)!,
          name: transition.name,
          requiresApproval: transition.requiresApproval,
          approvalStrategy: transition.requiresApproval ? transition.approvalStrategy : null,
          approverRole: transition.requiresApproval ? transition.approverRole : null,
          quorumCount: transition.requiresApproval ? (transition.quorumCount ?? null) : null
        }
      })
    )
  );

  return version;
}

export async function listWorkflows(tenantId: string, query: WorkflowListQuery) {
  const where: Prisma.WorkflowWhereInput = {};

  if (query.activeOnly) {
    where.activeVersionId = { not: null };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } }
    ];
  }

  const pagination = {
    page: query.page,
    limit: query.limit,
    skip: (query.page - 1) * query.limit
  };

  const [total, workflows] = await Promise.all([
    workflowRepository.countWorkflows(tenantId, where),
    workflowRepository.findWorkflows(tenantId, where, pagination)
  ]);

  return {
    data: workflows.map(workflowPayload),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      hasNextPage: pagination.skip + workflows.length < total
    }
  };
}

export async function getWorkflow(tenantId: string, workflowId: string) {
  const workflow = await workflowRepository.findWorkflowById(tenantId, workflowId);

  if (!workflow) {
    throw notFound("Workflow not found");
  }

  return workflowPayload(workflow);
}

export async function createWorkflow(tenantId: string, actorUserId: string, input: CreateWorkflowInput) {
  validateWorkflowDefinition(input.states, input.transitions);

  const workflow = await prisma.$transaction(async (tx) => {
    const createdWorkflow = await tx.workflow.create({
      data: {
        tenantId,
        name: input.name,
        slug: input.slug,
        slaDurationMinutes: input.slaDurationMinutes ?? null
      }
    });

    const version = await createVersion(tx, {
      tenantId,
      workflowId: createdWorkflow.id,
      versionNumber: 1,
      isActive: true,
      states: input.states,
      transitions: input.transitions
    });

    await tx.workflow.update({
      where: { id: createdWorkflow.id },
      data: { activeVersionId: version.id }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: AuditAction.WORKFLOW_CREATED,
        entityType: "workflow",
        entityId: createdWorkflow.id,
        metadata: {
          name: createdWorkflow.name,
          version: 1
        }
      }
    });

    return tx.workflow.findUniqueOrThrow({
      where: { id: createdWorkflow.id },
      include: {
        activeVersion: {
          include: {
            states: { orderBy: { position: "asc" } },
            transitions: { orderBy: { createdAt: "asc" } }
          }
        }
      }
    });
  });

  return workflowPayload(workflow);
}

export async function listWorkflowVersions(tenantId: string, workflowId: string) {
  const workflow = await workflowRepository.findWorkflowById(tenantId, workflowId);

  if (!workflow) {
    throw notFound("Workflow not found");
  }

  const versions = await workflowRepository.findWorkflowVersionHistory(tenantId, workflowId);

  return versions.map(versionPayload);
}

export async function cloneWorkflowVersion(
  tenantId: string,
  actorUserId: string,
  workflowId: string,
  input: CloneWorkflowVersionInput
) {
  const workflow = await workflowRepository.findWorkflowForClone(tenantId, workflowId);

  if (!workflow) {
    throw notFound("Workflow not found");
  }

  const latestVersion = workflow.versions[0];

  if (!latestVersion) {
    throw badRequest("WORKFLOW_HAS_NO_VERSION", "Workflow has no version to clone");
  }

  const states =
    input.states ??
    latestVersion.states.map((state) => ({
      key: state.key,
      name: state.name,
      position: state.position,
      isInitial: state.isInitial,
      isFinal: state.isFinal
    }));

  const stateKeyById = new Map(latestVersion.states.map((state) => [state.id, state.key]));
  const transitions =
    input.transitions ??
    latestVersion.transitions.map((transition) => ({
      fromStateKey: stateKeyById.get(transition.fromStateId)!,
      toStateKey: stateKeyById.get(transition.toStateId)!,
      name: transition.name,
      requiresApproval: transition.requiresApproval,
      approvalStrategy: transition.approvalStrategy ?? undefined,
      approverRole: approverRoleFromStoredRole(transition.approverRole),
      quorumCount: transition.quorumCount ?? undefined
    } satisfies TransitionInput));

  validateWorkflowDefinition(states, transitions);

  const version = await prisma.$transaction(async (tx) => {
    if (input.activate) {
      await tx.workflowVersion.updateMany({
        where: { tenantId, workflowId },
        data: { isActive: false }
      });
    }

    const createdVersion = await createVersion(tx, {
      tenantId,
      workflowId,
      versionNumber: latestVersion.version + 1,
      isActive: input.activate,
      states,
      transitions
    });

    if (input.activate) {
      await tx.workflow.update({
        where: { id: workflowId },
        data: { activeVersionId: createdVersion.id }
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: AuditAction.WORKFLOW_VERSION_CREATED,
        entityType: "workflow_version",
        entityId: createdVersion.id,
        metadata: {
          workflowId,
          version: createdVersion.version,
          activated: input.activate
        }
      }
    });

    return tx.workflowVersion.findUniqueOrThrow({
      where: { id: createdVersion.id },
      include: {
        states: { orderBy: { position: "asc" } },
        transitions: { orderBy: { createdAt: "asc" } }
      }
    });
  });

  return versionPayload(version);
}
