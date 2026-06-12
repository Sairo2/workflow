import { Router } from "express";
import { healthRouter } from "./health.js";
import { tenantRouter } from "./tenants.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/tenants", tenantRouter);
