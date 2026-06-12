import { Router } from "express";
import { listMyTenants } from "../controllers/tenantController.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const tenantRouter = Router();

tenantRouter.get("/", authMiddleware, asyncHandler(listMyTenants));
