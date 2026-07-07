import { Router } from "express";

import authMiddleware from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import { handleWebhook, verifyPayment } from "./payments.controller";
import { verifyPaymentSchema } from "./payments.schema";

const paymentsRouter = Router();

// Webhook — no auth, Razorpay sends raw JSON
paymentsRouter.post("/webhook", handleWebhook);

paymentsRouter.use(authMiddleware);

paymentsRouter.post("/verify", validate(verifyPaymentSchema), verifyPayment);

export default paymentsRouter;
