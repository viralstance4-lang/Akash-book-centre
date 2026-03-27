import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as printController from "./printorders.controller";

const router = Router();
const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/settings", printController.getPrintSettings);
router.post("/", authMiddleware, upload.single("pdf"), printController.createPrintOrder);
router.get("/my-orders", authMiddleware, printController.getUserPrintOrders);

adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/", printController.getAllPrintOrders);
adminRouter.patch("/:id/status", printController.updatePrintOrderStatus);
adminRouter.put("/settings", printController.upsertPrintSettings);

export default router;
export { adminRouter as adminPrintRouter };
