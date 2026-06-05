import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import * as ctrl from "./homepage-sections.controller";
import { CreateSectionSchema, UpdateSectionSchema, ReorderSchema } from "./homepage-sections.schema";

const publicRouter = Router();
const adminRouter  = Router();

// Public: storefront fetches enabled sections
publicRouter.get("/", ctrl.getPublic);

// Admin routes
adminRouter.use(authMiddleware, requireAdmin);
adminRouter.get("/",             ctrl.getAll);
adminRouter.post("/",            validate(CreateSectionSchema), ctrl.create);
adminRouter.put("/reorder",      validate(ReorderSchema),       ctrl.reorder);
adminRouter.put("/:id",          validate(UpdateSectionSchema), ctrl.update);
adminRouter.post("/:id/duplicate", ctrl.duplicate);
adminRouter.delete("/:id",       ctrl.remove);

export default publicRouter;
export { adminRouter as adminHomepageSectionsRouter };
