import type { Request, Response, NextFunction } from "express";
import * as couponsService from "./coupons.service";
import { createCouponSchema, validateCouponSchema } from "./coupons.schema";

export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, orderAmount } = validateCouponSchema.parse(req.body);
    const userId = req.user!.id;
    const result = await couponsService.validateCoupon(code, orderAmount, userId);
    res.json({ success: true, message: "Coupon applied", data: result });
  } catch (err) { next(err); }
};

export const getAllCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await couponsService.getAllCoupons();
    res.json({ success: true, message: "Coupons fetched", data: coupons });
  } catch (err) { next(err); }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createCouponSchema.parse(req.body);
    const coupon = await couponsService.createCoupon(data);
    res.status(201).json({ success: true, message: "Coupon created", data: coupon });
  } catch (err) { next(err); }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;
    const coupon = await couponsService.updateCoupon(id, req.body);
    res.json({ success: true, message: "Coupon updated", data: coupon });
  } catch (err) { next(err); }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;
    await couponsService.deleteCoupon(id);
    res.json({ success: true, message: "Coupon deleted", data: null });
  } catch (err) { next(err); }
};
