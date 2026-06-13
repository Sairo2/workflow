import { Router } from "express";
import { login, me, register } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../utils/validateRequest.js";
import { loginSchema, registerSchema } from "../validators/authSchema.js";

export const authRouter = Router();

authRouter.post("/register", validateRequest({ body: registerSchema }), asyncHandler(register));
authRouter.post("/login", validateRequest({ body: loginSchema }), asyncHandler(login));
authRouter.get("/me", authMiddleware, asyncHandler(me));
