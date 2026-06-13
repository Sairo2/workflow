import { Router } from "express";
import { index } from "../controllers/auditController.js";
import { authMiddleware } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../utils/validateRequest.js";
import { auditLogQuerySchema } from "../validators/auditSchema.js";

export const auditRouter = Router();

auditRouter.use(authMiddleware, tenantMiddleware);

auditRouter.get("/", validateRequest({ query: auditLogQuerySchema }), asyncHandler(index));
