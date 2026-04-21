import prisma from "../../lib/prisma";
import { AppError } from "../../lib/AppError";

export interface ShippingSettingsData {
  freeRadius: number;
  baseCharge: number;
  perKmCharge: number;
  maxCharge?: number;
  prepaidDiscountType: "PERCENT" | "FLAT";
  prepaidDiscountValue: number;
}

export class ShippingService {
  static async getShippingSettings() {
    let settings = await prisma.shippingSettings.findFirst();
    if (!settings) {
      // Create default settings
      settings = await prisma.shippingSettings.create({
        data: {
          freeRadius: 5.0,
          baseCharge: 50,
          perKmCharge: 10,
          maxCharge: null,
          prepaidDiscountType: "PERCENT",
          prepaidDiscountValue: 5,
        },
      });
    }
    return settings;
  }

  static async updateShippingSettings(data: ShippingSettingsData) {
    let settings = await prisma.shippingSettings.findFirst();
    if (!settings) {
      settings = await prisma.shippingSettings.create({ data });
    } else {
      settings = await prisma.shippingSettings.update({
        where: { id: settings.id },
        data,
      });
    }
    return settings;
  }

  static async calculateDeliveryCharge(distance: number) {
    const settings = await this.getShippingSettings();
    let deliveryCharge = 0;
    let deliveryType = "FREE";

    if (distance > settings.freeRadius) {
      const extraDistance = distance - settings.freeRadius;
      deliveryCharge = Number(settings.baseCharge) + extraDistance * Number(settings.perKmCharge);
      deliveryType = "PAID";

      if (settings.maxCharge && deliveryCharge > Number(settings.maxCharge)) {
        deliveryCharge = Number(settings.maxCharge);
      }
    }

    return { deliveryCharge, deliveryType };
  }

  static async calculatePrepaidDiscount(totalAmount: number) {
    const settings = await this.getShippingSettings();
    let discount = 0;

    if (settings.prepaidDiscountType === "PERCENT") {
      discount = totalAmount * (Number(settings.prepaidDiscountValue) / 100);
    } else {
      discount = Number(settings.prepaidDiscountValue);
    }

    return discount;
  }

  static calculateFinalAmount(totalAmount: number, deliveryCharge: number, discount: number) {
    const finalAmount = totalAmount + deliveryCharge - discount;
    return Math.max(finalAmount, 0); // Ensure not negative
  }
}