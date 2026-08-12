import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import * as pagesController from "./pages.controller";
import { createPageSchema, updatePageSchema } from "./pages.schema";

const router = Router();
const adminRouter = Router();

router.get("/footer", pagesController.getFooterPages);
router.get("/:slug", pagesController.getPage);

adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/", pagesController.getAllPages);
adminRouter.post("/", validate(createPageSchema), pagesController.createPage);
adminRouter.patch("/:id", validate(updatePageSchema), pagesController.updatePage);
adminRouter.delete("/:id", pagesController.deletePage);

export default router;
export { adminRouter as adminPagesRouter };
