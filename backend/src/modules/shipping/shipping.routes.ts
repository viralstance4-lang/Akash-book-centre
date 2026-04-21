import { Router } from "express";
import { ShippingController } from "./shipping.controller";
import authMiddleware from "../../middleware/auth.middleware";

const router = Router();

// Public route to get shipping settings
router.get("/shipping-settings", ShippingController.getShippingSettings);

// Admin route to update shipping settings
router.put("/admin/shipping-settings", authMiddleware, ShippingController.updateShippingSettings);

export default router;