import { Router } from "express";
import { create, index, show, transition } from "../controllers/itemController.js";
import { authMiddleware } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../utils/validateRequest.js";
import {
  createItemSchema,
  itemListQuerySchema,
  itemParamsSchema,
  transitionItemSchema
} from "../validators/itemSchema.js";

export const itemRouter = Router();

itemRouter.use(authMiddleware, tenantMiddleware);

itemRouter.get("/", validateRequest({ query: itemListQuerySchema }), asyncHandler(index));
itemRouter.post("/", validateRequest({ body: createItemSchema }), asyncHandler(create));
itemRouter.get("/:id", validateRequest({ params: itemParamsSchema }), asyncHandler(show));
itemRouter.post(
  "/:id/transitions",
  validateRequest({ params: itemParamsSchema, body: transitionItemSchema }),
  asyncHandler(transition)
);
