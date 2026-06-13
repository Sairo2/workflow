import { z } from "zod";
import { paginationSchema } from "../utils/pagination.js";

export const itemParamsSchema = z.object({
  id: z.string().uuid()
});

export const itemListQuerySchema = paginationSchema.extend({
  state: z.string().trim().min(2).max(40).optional(),
  workflowVersionId: z.string().uuid().optional()
});

export const createItemSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  workflowVersionId: z.string().uuid()
});

export const transitionItemSchema = z.object({
  toStateId: z.string().uuid(),
  currentVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(120).optional()
});

export type ItemListQuery = z.infer<typeof itemListQuerySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type TransitionItemInput = z.infer<typeof transitionItemSchema>;
