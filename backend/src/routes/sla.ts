import { TenantRole } from "@prisma/client";
import { Router } from "express";
import { checkBreaches } from "../controllers/slaController.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const slaRouter = Router();

slaRouter.use(authMiddleware, tenantMiddleware);

slaRouter.post("/check", requireRole(TenantRole.ADMIN), asyncHandler(checkBreaches));
