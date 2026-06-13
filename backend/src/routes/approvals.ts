import { Router } from "express";
import { approve, pending, reject } from "../controllers/approvalController.js";
import { authMiddleware } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../utils/validateRequest.js";
import { approvalDecisionSchema, approvalParamsSchema } from "../validators/approvalSchema.js";

export const approvalRouter = Router();

approvalRouter.use(authMiddleware, tenantMiddleware);

approvalRouter.get("/pending", asyncHandler(pending));
approvalRouter.post(
  "/:id/approve",
  validateRequest({ params: approvalParamsSchema, body: approvalDecisionSchema }),
  asyncHandler(approve)
);
approvalRouter.post(
  "/:id/reject",
  validateRequest({ params: approvalParamsSchema, body: approvalDecisionSchema }),
  asyncHandler(reject)
);
