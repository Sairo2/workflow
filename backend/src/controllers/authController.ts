import type { Request, Response } from "express";
import { getCurrentUser, loginUser, registerUser } from "../services/authService.js";
import type { LoginInput, RegisterInput } from "../validators/authSchema.js";

export async function register(req: Request, res: Response) {
  const session = await registerUser(req.body as RegisterInput);

  res.status(201).json({
    data: session
  });
}

export async function login(req: Request, res: Response) {
  const session = await loginUser(req.body as LoginInput);

  res.json({
    data: session
  });
}

export async function me(req: Request, res: Response) {
  const data = await getCurrentUser(req.user!.id);

  res.json({
    data
  });
}
