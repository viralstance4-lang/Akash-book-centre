import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as ctrl from "./shiprocket.controller";

// ── Public webhook (called by Shiprocket) ─────────────────────────────────────
const webhookRouter = Router();
webhookRouter.post("/webhook", ctrl.handleWebhook);

// ── Admin-only routes (auth + admin guard) ────────────────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware, requireAdmin);

adminRouter.get( "/pickup-locations",         ctrl.getPickupLocations);
adminRouter.post("/test-auth",                ctrl.testAuthHandler);
adminRouter.post("/:orderId/create-shipment", ctrl.createShipment);
adminRouter.post("/:orderId/generate-awb",    ctrl.generateAWB);
adminRouter.post("/:orderId/label",           ctrl.generateLabel);
adminRouter.post("/:orderId/invoice",         ctrl.generateInvoice);
adminRouter.post("/:orderId/manifest",        ctrl.generateManifest);
adminRouter.get( "/:orderId/track",           ctrl.trackShipment);
adminRouter.post("/:orderId/cancel",          ctrl.cancelShipment);
adminRouter.post("/:orderId/sync",            ctrl.syncStatus);

export { webhookRouter as shiprocketWebhookRouter };
export default adminRouter;
