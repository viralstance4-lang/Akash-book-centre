import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware";
import { downloadFile, viewFile } from "./pdf.controller";

const pdfRouter = Router();

// Both routes require authentication — the controller additionally checks
// that the requesting user owns the print order (or is ADMIN)
pdfRouter.use(authMiddleware);

pdfRouter.get("/view/:fileId",     viewFile);
pdfRouter.get("/download/:fileId", downloadFile);

export default pdfRouter;
