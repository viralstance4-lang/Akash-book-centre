import { Router } from "express";

import authMiddleware from "../../middleware/auth.middleware";
import {
  addItemToCart,
  clearUserCart,
  getCart,
  removeItemFromCart,
  updateCartItemQuantity,
} from "./cart.controller";

const cartRouter = Router();

cartRouter.use(authMiddleware);

cartRouter.get("/", getCart);
cartRouter.post("/items", addItemToCart);
cartRouter.patch("/items/:bookId", updateCartItemQuantity);
cartRouter.delete("/items/:bookId", removeItemFromCart);
cartRouter.delete("/", clearUserCart);
cartRouter.delete("/clear", clearUserCart);

export default cartRouter;
