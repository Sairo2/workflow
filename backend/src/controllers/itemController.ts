import type { Request, Response } from "express";
import { createItem, getItem, listItems, transitionItem } from "../services/itemService.js";
import type { CreateItemInput, ItemListQuery, TransitionItemInput } from "../validators/itemSchema.js";

export async function index(req: Request, res: Response) {
  const result = await listItems(req.tenant!.id, req.validated?.query as ItemListQuery);

  res.json(result);
}

export async function show(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const item = await getItem(req.tenant!.id, params.id);

  res.json({ data: item });
}

export async function create(req: Request, res: Response) {
  const item = await createItem(req.tenant!.id, req.user!.id, req.validated?.body as CreateItemInput);

  res.status(201).json({ data: item });
}

export async function transition(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const item = await transitionItem(
    req.tenant!.id,
    req.user!.id,
    params.id,
    req.validated?.body as TransitionItemInput
  );

  res.json({ data: item });
}
