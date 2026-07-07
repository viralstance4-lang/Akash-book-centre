import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as ctrl from "./shipmozo.controller";

const adminRouter = Router();
adminRouter.use(authMiddleware, requireAdmin);

adminRouter.post("/test-connection",          ctrl.testConnection);
adminRouter.get( "/serviceability",           ctrl.checkServiceability);
adminRouter.post("/:orderId/create-shipment", ctrl.createShipment);
adminRouter.post("/:orderId/assign-courier",  ctrl.assignCourier);
adminRouter.post("/:orderId/label",           ctrl.getLabel);
adminRouter.post("/:orderId/manifest",        ctrl.generateManifest);
adminRouter.get( "/:orderId/track",           ctrl.trackShipment);
adminRouter.post("/:orderId/cancel",          ctrl.cancelShipment);

export default adminRouter;
