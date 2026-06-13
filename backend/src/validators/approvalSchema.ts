import { z } from "zod";

export const approvalParamsSchema = z.object({
  id: z.string().uuid()
});

export const approvalDecisionSchema = z.object({
  comment: z.string().trim().max(1000).optional()
});

export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
