import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as settingsController from "./settings.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", settingsController.getSettings);
router.patch("/", authMiddleware, requireAdmin, upload.single("logo"), settingsController.updateSettings);

export default router;
