import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as pagesController from "./pages.controller";

const router = Router();
const adminRouter = Router();

router.get("/footer", pagesController.getFooterPages);
router.get("/:slug", pagesController.getPage);

adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/", pagesController.getAllPages);
adminRouter.post("/", pagesController.createPage);
adminRouter.patch("/:id", pagesController.updatePage);
adminRouter.delete("/:id", pagesController.deletePage);

export default router;
export { adminRouter as adminPagesRouter };
