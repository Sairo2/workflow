import type { Request, Response } from "express";
import {
  createDelegation,
  listOutgoingDelegations,
  revokeDelegation
} from "../services/delegationService.js";
import type { CreateDelegationInput } from "../validators/delegationSchema.js";

export async function index(req: Request, res: Response) {
  const delegations = await listOutgoingDelegations(req.tenant!.id, req.user!.id);

  res.json({ data: delegations });
}

export async function create(req: Request, res: Response) {
  const delegation = await createDelegation(
    req.tenant!.id,
    req.user!.id,
    req.validated?.body as CreateDelegationInput
  );

  res.status(201).json({ data: delegation });
}

export async function revoke(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const delegation = await revokeDelegation(req.tenant!.id, req.user!.id, params.id);

  res.json({ data: delegation });
}
