import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as mediaController from "./media.controller";

// Admin-only — lets an admin browse everything actually sitting in Cloudinary
// storage and delete orphaned files directly, instead of them piling up forever
// (e.g. gallery images left behind when a book is deleted — see books.service.ts's
// deleteBook, which only cleans up the cover, not BookImage rows).
const adminRouter = Router();
adminRouter.use(authMiddleware, requireAdmin);

adminRouter.get("/", mediaController.listMedia);
adminRouter.get("/usage", mediaController.getUsage);
// publicId is URL-encoded by the client (Cloudinary ids contain "/", sent as %2F)
// so it arrives here as a single path segment and Express decodes it back for us.
adminRouter.delete("/:publicId", mediaController.deleteMedia);

export { adminRouter as adminMediaRouter };
