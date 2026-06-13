import { z } from "zod";

const email = z.string().trim().email().toLowerCase();
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password
});

export const loginSchema = z.object({
  email,
  password
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
