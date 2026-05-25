import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as bannersController from "./banners.controller";

const router = Router();
const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Accept desktopImage and mobileImage for both create and update
const uploadFields = upload.fields([
  { name: "desktopImage", maxCount: 1 },
  { name: "mobileImage",  maxCount: 1 },
]);

// Public
router.get("/", bannersController.getBanners);

// Admin
adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/",     bannersController.getAdminBanners);
adminRouter.post("/",    uploadFields, bannersController.createBanner);
adminRouter.patch("/:id", uploadFields, bannersController.updateBanner);
adminRouter.delete("/:id", bannersController.deleteBanner);

export default router;
export { adminRouter as adminBannersRouter };
