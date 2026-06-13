import { z } from "zod";
import { paginationSchema } from "../utils/pagination.js";

export const auditLogQuerySchema = paginationSchema.extend({
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional()
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
