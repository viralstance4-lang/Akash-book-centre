import { type RequestHandler } from "express";

import AppError from "../../lib/AppError";
import {
  addToCart,
  clearCart,
  getOrCreateCart,
  removeCartItem,
  updateCartItem,
} from "./cart.service";

const getUserIdOrThrow = (userId?: string) => {
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return userId;
};

const parseQuantity = (value: unknown) => {
  const quantity = Number(value);

  if (Number.isNaN(quantity)) {
    throw new AppError("Quantity must be a valid number", 400, "INVALID_QUANTITY");
  }

  return quantity;
};

export const getCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(getUserIdOrThrow(req.user?.id));

    res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const addItemToCart: RequestHandler = async (req, res, next) => {
  try {
    const cart = await addToCart(
      getUserIdOrThrow(req.user?.id),
      req.body.bookId,
      parseQuantity(req.body.quantity),
    );

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCartItemQuantity: RequestHandler<{ bookId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const cart = await updateCartItem(
      getUserIdOrThrow(req.user?.id),
      req.params.bookId,
      parseQuantity(req.body.quantity),
    );

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const removeItemFromCart: RequestHandler<{ bookId: string }> = async (
  req,
  res,
  next,
) => {
  try {
    await removeCartItem(getUserIdOrThrow(req.user?.id), req.params.bookId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const clearUserCart: RequestHandler = async (req, res, next) => {
  try {
    await clearCart(getUserIdOrThrow(req.user?.id));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
