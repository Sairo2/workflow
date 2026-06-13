import { ApprovalStrategy, TenantRole } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../utils/pagination.js";

const stateKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase keys like NEW or IN_PROGRESS");

const workflowStateSchema = z.object({
  key: stateKeySchema,
  name: z.string().trim().min(2).max(80),
  position: z.number().int().min(1),
  isInitial: z.boolean().default(false),
  isFinal: z.boolean().default(false)
});

const workflowTransitionSchema = z
  .object({
    fromStateKey: stateKeySchema,
    toStateKey: stateKeySchema,
    name: z.string().trim().min(2).max(80),
    requiresApproval: z.boolean().default(false),
    approvalStrategy: z.nativeEnum(ApprovalStrategy).optional(),
    approverRole: z.enum([TenantRole.ADMIN, TenantRole.APPROVER]).optional(),
    quorumCount: z.number().int().min(1).optional()
  })
  .superRefine((transition, ctx) => {
    if (!transition.requiresApproval) {
      return;
    }

    if (!transition.approvalStrategy) {
      ctx.addIssue({
        code: "custom",
        path: ["approvalStrategy"],
        message: "Approval strategy is required when approval is enabled"
      });
    }

    if (!transition.approverRole) {
      ctx.addIssue({
        code: "custom",
        path: ["approverRole"],
        message: "Approver role is required when approval is enabled"
      });
    }

    if (transition.approvalStrategy === ApprovalStrategy.QUORUM && !transition.quorumCount) {
      ctx.addIssue({
        code: "custom",
        path: ["quorumCount"],
        message: "Quorum count is required for quorum approval"
      });
    }
  });

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug like ticket-workflow"),
  slaDurationMinutes: z.number().int().positive().max(60 * 24 * 30).optional(),
  states: z.array(workflowStateSchema).min(2),
  transitions: z.array(workflowTransitionSchema).min(1)
});

export const cloneWorkflowVersionSchema = z.object({
  states: z.array(workflowStateSchema).min(2).optional(),
  transitions: z.array(workflowTransitionSchema).min(1).optional(),
  activate: z.boolean().default(true)
});

export const workflowParamsSchema = z.object({
  id: z.string().uuid()
});

export const workflowListQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  activeOnly: z.coerce.boolean().default(true)
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type CloneWorkflowVersionInput = z.infer<typeof cloneWorkflowVersionSchema>;
export type WorkflowListQuery = z.infer<typeof workflowListQuerySchema>;
