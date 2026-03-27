import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as reviewsController from "./reviews.controller";

const router = Router();
const adminRouter = Router();

router.get("/:bookId", reviewsController.getBookReviews);
router.post("/:bookId", authMiddleware, reviewsController.createReview);

adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/", reviewsController.getAllReviews);
adminRouter.patch("/:id/approve", reviewsController.approveReview);
adminRouter.delete("/:id", reviewsController.deleteReview);

export default router;
export { adminRouter as adminReviewsRouter };
