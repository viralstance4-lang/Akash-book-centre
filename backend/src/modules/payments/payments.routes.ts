import { Router } from "express";

import authMiddleware from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import { verifyPayment } from "./payments.controller";
import { verifyPaymentSchema } from "./payments.schema";

const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

paymentsRouter.post("/verify", validate(verifyPaymentSchema), verifyPayment);

export default paymentsRouter;
