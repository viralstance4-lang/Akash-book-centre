import { type RequestHandler } from "express";
import jwt, {
  JsonWebTokenError,
  TokenExpiredError,
  type JwtPayload,
  type Secret,
} from "jsonwebtoken";

import env from "../config/env";
import AppError from "../lib/AppError";
import prisma from "../lib/prisma";

const JWT_ACCESS_SECRET: Secret = env.JWT_ACCESS_SECRET;

type AuthTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: string;
};

const authMiddleware: RequestHandler = (req, res, next) => {
  void res;

  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));
    return;
  }

  const token = authorizationHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    if (typeof decoded === "string") {
      next(new AppError("Invalid token", 401, "INVALID_TOKEN"));
      return;
    }

    const payload = decoded as AuthTokenPayload;

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new AppError("Token expired", 401, "TOKEN_EXPIRED"));
      return;
    }

    if (error instanceof JsonWebTokenError) {
      next(new AppError("Invalid token", 401, "INVALID_TOKEN"));
      return;
    }

    next(error);
  }
};

// Re-checks the role against the DB (rather than trusting the JWT's baked-in
// role) so a demoted/deleted admin loses access immediately instead of
// retaining admin API access for the rest of their token's lifetime.
export const requireAdmin: RequestHandler = async (req, res, next) => {
  void res;

  if (req.user?.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
  if (!user || user.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  next();
};

export default authMiddleware;
