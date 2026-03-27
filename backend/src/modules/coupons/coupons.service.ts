import AppError from "../../lib/AppError";
import prisma from "../../lib/prisma";

export const validateCoupon = async (code: string, orderAmount: number, userId: string) => {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon) throw new AppError("Invalid coupon code", 400, "INVALID_COUPON");
  if (!coupon.isActive) throw new AppError("Coupon is inactive", 400, "COUPON_INACTIVE");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError("Coupon has expired", 400, "COUPON_EXPIRED");
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new AppError("Coupon usage limit reached", 400, "COUPON_LIMIT_REACHED");
  if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
    throw new AppError(`Minimum order amount is ₹${coupon.minOrderAmount}`, 400, "COUPON_MIN_ORDER");
  }
  const alreadyUsed = await prisma.couponUse.findFirst({ where: { couponId: coupon.id, userId } });
  if (alreadyUsed) throw new AppError("You have already used this coupon", 400, "COUPON_ALREADY_USED");
  const discount = coupon.discountType === "percentage"
    ? (orderAmount * Number(coupon.discountValue)) / 100
    : Math.min(Number(coupon.discountValue), orderAmount);
  return { coupon, discount: Math.round(discount * 100) / 100, finalAmount: Math.max(0, orderAmount - discount) };
};

export const getAllCoupons = async () => prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

export const createCoupon = async (data: any) => {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code.toUpperCase() } });
  if (existing) throw new AppError("Coupon code already exists", 409, "COUPON_EXISTS");
  return prisma.coupon.create({
    data: {
      code: data.code.toUpperCase(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount ?? null,
      maxUses: data.maxUses ?? null,
      isActive: data.isActive ?? true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
};

export const updateCoupon = async (id: string, data: any) => prisma.coupon.update({ where: { id }, data });
export const deleteCoupon = async (id: string) => prisma.coupon.delete({ where: { id } });
