import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { conflict, unauthorized } from "../utils/errors.js";
import type { LoginInput, RegisterInput } from "../validators/authSchema.js";

const tokenTtl = "7d";

function publicUser(user: { id: string; email: string; name: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}

function signToken(userId: string) {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: tokenTtl
  });
}

async function membershipsForUser(userId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: { tenant: { name: "asc" } }
  });

  return memberships.map((membership) => ({
    tenantId: membership.tenant.id,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
    role: membership.role
  }));
}

export async function registerUser(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    return {
      token: signToken(user.id),
      user: publicUser(user),
      memberships: []
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("EMAIL_ALREADY_REGISTERED", "A user with this email already exists");
    }

    throw error;
  }
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true
    }
  });

  if (!user) {
    throw unauthorized("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw unauthorized("Invalid email or password");
  }

  return {
    token: signToken(user.id),
    user: publicUser(user),
    memberships: await membershipsForUser(user.id)
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  if (!user) {
    throw unauthorized("Invalid session");
  }

  return {
    user: publicUser(user),
    memberships: await membershipsForUser(user.id)
  };
}
