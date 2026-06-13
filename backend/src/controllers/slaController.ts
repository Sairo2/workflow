import type { Request, Response } from "express";
import { detectSlaBreaches } from "../services/slaService.js";

export async function checkBreaches(req: Request, res: Response) {
  const result = await detectSlaBreaches(req.tenant!.id);

  res.json({ data: result });
}
