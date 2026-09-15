import { z } from "zod";

export const bulkDeleteMediaSchema = z.object({
  publicIds: z.array(z.string().min(1)).min(1).max(100),
  type: z.enum(["image", "video"]).default("image"),
});
