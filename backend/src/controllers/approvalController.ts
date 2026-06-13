import { ApprovalStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { decideApproval, listPendingApprovals } from "../services/approvalService.js";
import type { ApprovalDecisionInput } from "../validators/approvalSchema.js";

export async function pending(req: Request, res: Response) {
  const approvals = await listPendingApprovals(req.tenant!.id, req.user!.id);

  res.json({ data: approvals });
}

export async function approve(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const approval = await decideApproval(
    req.tenant!.id,
    req.user!.id,
    params.id,
    ApprovalStatus.APPROVED,
    req.validated?.body as ApprovalDecisionInput
  );

  res.json({ data: approval });
}

export async function reject(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const approval = await decideApproval(
    req.tenant!.id,
    req.user!.id,
    params.id,
    ApprovalStatus.REJECTED,
    req.validated?.body as ApprovalDecisionInput
  );

  res.json({ data: approval });
}
