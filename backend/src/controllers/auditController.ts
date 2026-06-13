import type { Request, Response } from "express";
import { listAuditLogs } from "../services/auditService.js";
import type { AuditLogQuery } from "../validators/auditSchema.js";

export async function index(req: Request, res: Response) {
  const result = await listAuditLogs(req.tenant!.id, req.validated?.query as AuditLogQuery);

  res.json(result);
}
