import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as featuredController from "./featured.controller";

const router = Router();
const adminRouter = Router();

router.get("/", featuredController.getFeatured);

adminRouter.use(authMiddleware, requireAdmin);
adminRouter.post("/", featuredController.addFeatured);
adminRouter.delete("/:bookId", featuredController.removeFeatured);

export default router;
export { adminRouter as adminFeaturedRouter };
