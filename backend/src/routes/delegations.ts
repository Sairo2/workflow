import { Router } from "express";
import { create, index, revoke } from "../controllers/delegationController.js";
import { authMiddleware } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../utils/validateRequest.js";
import { createDelegationSchema, delegationParamsSchema } from "../validators/delegationSchema.js";

export const delegationRouter = Router();

delegationRouter.use(authMiddleware, tenantMiddleware);

delegationRouter.get("/", asyncHandler(index));
delegationRouter.post("/", validateRequest({ body: createDelegationSchema }), asyncHandler(create));
delegationRouter.delete(
  "/:id",
  validateRequest({ params: delegationParamsSchema }),
  asyncHandler(revoke)
);
