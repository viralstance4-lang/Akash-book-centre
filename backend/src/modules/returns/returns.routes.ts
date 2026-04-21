import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import {
  createReturn,
  getReturn,
  getUserReturns,
  getAdminReturns,
  getAdminReturnDetail,
  updateReturnStatus,
} from "./returns.controller";
import { createReturnSchema, updateReturnStatusSchema } from "./returns.schema";

const returnsRouter = Router();
export const adminReturnsRouter = Router();

// User routes
returnsRouter.use(authMiddleware);

returnsRouter.post("/", validate(createReturnSchema), createReturn);
returnsRouter.get("/", getUserReturns);
returnsRouter.get("/:id", getReturn);

// Admin routes
adminReturnsRouter.use(authMiddleware, requireAdmin);

adminReturnsRouter.get("/", getAdminReturns);
adminReturnsRouter.get("/:id", getAdminReturnDetail);
adminReturnsRouter.patch("/:id/status", validate(updateReturnStatusSchema), updateReturnStatus);

export default returnsRouter;
