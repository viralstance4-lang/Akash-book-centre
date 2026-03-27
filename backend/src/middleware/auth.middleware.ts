import { type RequestHandler } from "express";
import jwt, {
  JsonWebTokenError,
  TokenExpiredError,
  type JwtPayload,
  type Secret,
} from "jsonwebtoken";

import env from "../config/env";
import AppError from "../lib/AppError";

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
    if (
      error instanceof JsonWebTokenError ||
      error instanceof TokenExpiredError
    ) {
      next(new AppError("Invalid token", 401, "INVALID_TOKEN"));
      return;
    }

    next(error);
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  void res;

  if (req.user?.role !== "ADMIN") {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  next();
};

export default authMiddleware;
