import { Router } from "express";
import { approvalRouter } from "./approvals.js";
import { auditRouter } from "./audit.js";
import { authRouter } from "./auth.js";
import { delegationRouter } from "./delegations.js";
import { healthRouter } from "./health.js";
import { itemRouter } from "./items.js";
import { slaRouter } from "./sla.js";
import { tenantRouter } from "./tenants.js";
import { workflowRouter } from "./workflows.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/tenants", tenantRouter);
apiRouter.use("/workflows", workflowRouter);
apiRouter.use("/items", itemRouter);
apiRouter.use("/approvals", approvalRouter);
apiRouter.use("/delegations", delegationRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/sla", slaRouter);
