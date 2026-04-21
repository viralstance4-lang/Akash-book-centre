import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as printController from "./printorders.controller";

const router      = Router();
const adminRouter = Router();

// Multer: accept up to 50 files in memory; the service enforces the DB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },  // 50 MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are accepted"));
  },
});

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/settings", printController.getPrintSettings);

// ─── Authenticated ────────────────────────────────────────────────────────────
router.post(
  "/",
  authMiddleware,
  // Accept field name "pdfs" (multiple) or legacy "pdf" (single)
  upload.fields([
    { name: "pdfs", maxCount: 50 },
    { name: "pdf",  maxCount: 1  },
  ]),
  // Merge files from both field names into req.files array
  (req, _res, next) => {
    const fields = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (fields) {
      const pdfs   = fields["pdfs"]  ?? [];
      const legacy = fields["pdf"]   ?? [];
      (req as any).files = [...pdfs, ...legacy];
    }
    next();
  },
  printController.createPrintOrder,
);
router.get("/my-orders", authMiddleware, printController.getUserPrintOrders);

// ─── Admin ────────────────────────────────────────────────────────────────────
adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/",              printController.getAllPrintOrders);
adminRouter.patch("/:id/status",  printController.updatePrintOrderStatus);
adminRouter.delete("/:id",        printController.deletePrintOrder);
adminRouter.put("/settings",      printController.upsertPrintSettings);

export default router;
export { adminRouter as adminPrintRouter };
