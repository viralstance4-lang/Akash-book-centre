import { Router } from "express";

import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import {
  cancelOrder,
  getAdminOrder,
  getAdminOrdersList,
  getOrder,
  getOrders,
  placeOrder,
  updateAdminOrderStatus,
} from "./orders.controller";
import { placeOrderSchema, updateOrderStatusSchema } from "./orders.schema";

const ordersRouter = Router();
export const adminOrdersRouter = Router();

ordersRouter.use(authMiddleware);

ordersRouter.post("/", validate(placeOrderSchema), placeOrder);
ordersRouter.get("/", getOrders);
ordersRouter.get("/:id", getOrder);
ordersRouter.post("/:id/cancel", cancelOrder);

adminOrdersRouter.use(authMiddleware, requireAdmin);
adminOrdersRouter.get("/", getAdminOrdersList);
adminOrdersRouter.get("/:id", getAdminOrder);
adminOrdersRouter.patch(
  "/:id/status",
  validate(updateOrderStatusSchema),
  updateAdminOrderStatus,
);

export default ordersRouter;
