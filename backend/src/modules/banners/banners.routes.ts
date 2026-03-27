import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as bannersController from "./banners.controller";

const router = Router();
const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public
router.get("/", bannersController.getBanners);

// Admin
adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/", bannersController.getAdminBanners);
adminRouter.post("/", upload.single("image"), bannersController.createBanner);
adminRouter.patch("/:id", bannersController.updateBanner);
adminRouter.delete("/:id", bannersController.deleteBanner);

export default router;
export { adminRouter as adminBannersRouter };
