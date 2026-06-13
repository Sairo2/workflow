import { TenantRole } from "@prisma/client";
import { Router } from "express";
import {
  cloneVersion,
  create,
  index,
  show,
  versions
} from "../controllers/workflowController.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../utils/validateRequest.js";
import {
  cloneWorkflowVersionSchema,
  createWorkflowSchema,
  workflowListQuerySchema,
  workflowParamsSchema
} from "../validators/workflowSchema.js";

export const workflowRouter = Router();

workflowRouter.use(authMiddleware, tenantMiddleware);

workflowRouter.get("/", validateRequest({ query: workflowListQuerySchema }), asyncHandler(index));
workflowRouter.post("/", requireRole(TenantRole.ADMIN), validateRequest({ body: createWorkflowSchema }), asyncHandler(create));
workflowRouter.get("/:id", validateRequest({ params: workflowParamsSchema }), asyncHandler(show));
workflowRouter.get("/:id/versions", validateRequest({ params: workflowParamsSchema }), asyncHandler(versions));
workflowRouter.post(
  "/:id/versions",
  requireRole(TenantRole.ADMIN),
  validateRequest({ params: workflowParamsSchema, body: cloneWorkflowVersionSchema }),
  asyncHandler(cloneVersion)
);
