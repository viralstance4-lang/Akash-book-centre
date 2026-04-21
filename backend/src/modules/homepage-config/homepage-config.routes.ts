import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import * as controller from "./homepage-config.controller";
import { UpdateHomepageConfigSchema } from "./homepage-config.schema";

const publicRouter  = Router();
const adminRouter   = Router();

// Public: storefront fetches this to render homepage dynamically
publicRouter.get("/", controller.getConfig);

// Admin: update the homepage layout
adminRouter.use(authMiddleware, requireAdmin);
adminRouter.put("/", validate(UpdateHomepageConfigSchema), controller.updateConfig);

export default publicRouter;
export { adminRouter as adminHomepageConfigRouter };
