import { Router } from "express";

import authMiddleware from "../middleware/auth.middleware";
import { authRateLimiter } from "../middleware/rateLimiter";
import { login, logout, me, refresh, register } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schema";
import validate from "../middleware/validate";

const authRouter = Router();

authRouter.post("/register", authRateLimiter, validate(registerSchema), register);
authRouter.post("/login", authRateLimiter, validate(loginSchema), login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", authMiddleware, logout);
authRouter.get("/me", authMiddleware, me);

export default authRouter;
