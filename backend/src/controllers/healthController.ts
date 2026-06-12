import type { Request, Response } from "express";

export function healthCheck(_req: Request, res: Response) {
  res.json({
    data: {
      ok: true,
      service: "workflow-approval-api"
    }
  });
}
