import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { unauthorized } from "../utils/errors.js";

type JwtPayload = {
  sub: string;
};

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    next(unauthorized());
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      next(unauthorized("Invalid session"));
      return;
    }

    req.user = user;
    next();
  } catch {
    next(unauthorized("Invalid session"));
  }
}
