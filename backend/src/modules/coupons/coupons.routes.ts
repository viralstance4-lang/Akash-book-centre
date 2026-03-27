import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as couponsController from "./coupons.controller";

const router = Router();
const adminRouter = Router();

router.post("/validate", authMiddleware, couponsController.validateCoupon);

adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/", couponsController.getAllCoupons);
adminRouter.post("/", couponsController.createCoupon);
adminRouter.patch("/:id", couponsController.updateCoupon);
adminRouter.delete("/:id", couponsController.deleteCoupon);

export default router;
export { adminRouter as adminCouponsRouter };
