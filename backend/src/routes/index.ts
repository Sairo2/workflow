import { Router } from "express";
import { authRouter } from "./auth.js";
import { healthRouter } from "./health.js";
import { tenantRouter } from "./tenants.js";
import { workflowRouter } from "./workflows.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/tenants", tenantRouter);
apiRouter.use("/workflows", workflowRouter);
