import { Request, Response } from "express";
import { ShippingService } from "./shipping.service";

export class ShippingController {
  static async getShippingSettings(req: Request, res: Response) {
    try {
      const settings = await ShippingService.getShippingSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching shipping settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async updateShippingSettings(req: Request, res: Response) {
    try {
      const data = req.body;
      const settings = await ShippingService.updateShippingSettings(data);
      res.json(settings);
    } catch (error) {
      console.error("Error updating shipping settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}