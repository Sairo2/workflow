import type { Request, Response } from "express";
import {
  cloneWorkflowVersion,
  createWorkflow,
  getWorkflow,
  listWorkflowVersions,
  listWorkflows
} from "../services/workflowService.js";
import type {
  CloneWorkflowVersionInput,
  CreateWorkflowInput,
  WorkflowListQuery
} from "../validators/workflowSchema.js";

export async function index(req: Request, res: Response) {
  const result = await listWorkflows(req.tenant!.id, req.validated?.query as WorkflowListQuery);

  res.json(result);
}

export async function show(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const workflow = await getWorkflow(req.tenant!.id, params.id);

  res.json({ data: workflow });
}

export async function create(req: Request, res: Response) {
  const workflow = await createWorkflow(req.tenant!.id, req.user!.id, req.validated?.body as CreateWorkflowInput);

  res.status(201).json({ data: workflow });
}

export async function versions(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const workflowVersions = await listWorkflowVersions(req.tenant!.id, params.id);

  res.json({ data: workflowVersions });
}

export async function cloneVersion(req: Request, res: Response) {
  const params = req.validated?.params as { id: string };
  const version = await cloneWorkflowVersion(
    req.tenant!.id,
    req.user!.id,
    params.id,
    req.validated?.body as CloneWorkflowVersionInput
  );

  res.status(201).json({ data: version });
}
