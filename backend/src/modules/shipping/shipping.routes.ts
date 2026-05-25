import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import {
  getPublicShippingConfig,
  calculateShipping,
  getAdminShippingConfig,
  updateAdminShippingConfig,
  adminTestCalculation,
} from "./shipping.controller";
import { calculateShippingSchema, updateShippingConfigSchema } from "./shipping.schema";

// ── Public storefront routes (/api/v1/shipping/...) ──────────────────────────
const shippingRouter = Router();

shippingRouter.get("/config",    getPublicShippingConfig);
shippingRouter.post("/calculate", validate(calculateShippingSchema), calculateShipping);

// ── Admin routes (/api/v1/admin/shipping/...) ─────────────────────────────────
export const adminShippingRouter = Router();

const adminMw = [authMiddleware, requireAdmin] as const;
adminShippingRouter.use(...adminMw);

adminShippingRouter.get("/config",     getAdminShippingConfig);
adminShippingRouter.put("/config",     validate(updateShippingConfigSchema), updateAdminShippingConfig);
adminShippingRouter.post("/calculate", validate(calculateShippingSchema), adminTestCalculation);

export default shippingRouter;
