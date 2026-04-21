import prisma from "../../lib/prisma";
import { uploadImage, deleteImage } from "../../lib/cloudinary";

export const getSettings = async () => prisma.siteSettings.findFirst();

export const updateLogoSettings = async (
  data: {
    storeName?: string;
    tagline?: string;
    logoWidth?: string;
    logoHeight?: string;
    removeLogo?: string;
    spiralBindingPrice?: string;
  },
  file?: any
) => {
  console.log("[DEBUG] updateLogoSettings called with data:", data);
  const existing = await prisma.siteSettings.findFirst();
  const updateData: any = {};

  if (data.storeName !== undefined) updateData.storeName = data.storeName;
  if (data.tagline !== undefined) updateData.tagline = data.tagline;
  if (data.logoWidth) updateData.logoWidth = Number(data.logoWidth);
  if (data.logoHeight) updateData.logoHeight = Number(data.logoHeight);
  if (data.spiralBindingPrice !== undefined)
    updateData.spiralBindingPrice = Number(data.spiralBindingPrice);

  if (data.removeLogo === "true") {
    if (existing?.logoPublicId) await deleteImage(existing.logoPublicId).catch(() => {});
    updateData.logoUrl = null;
    updateData.logoPublicId = null;
  }

  if (file) {
    if (existing?.logoPublicId) await deleteImage(existing.logoPublicId).catch(() => {});
    const uploaded = await uploadImage(file, "settings");
    updateData.logoUrl = uploaded.url;
    updateData.logoPublicId = uploaded.publicId;
  }

  let result;
  if (existing) {
    console.log("[DEBUG] Updating existing settings with:", updateData);
    result = await prisma.siteSettings.update({ where: { id: existing.id }, data: updateData });
  } else {
    console.log("[DEBUG] Creating new settings with:", { storeName: data.storeName, tagline: data.tagline, ...updateData });
    result = await prisma.siteSettings.create({
      data: {
        storeName: data.storeName ?? "Akash Book Centre",
        tagline: data.tagline ?? "",
        logoWidth: Number(data.logoWidth ?? 120),
        logoHeight: Number(data.logoHeight ?? 40),
        spiralBindingPrice: Number(data.spiralBindingPrice ?? 30),
        ...updateData,
      },
    });
  }
  console.log("[DEBUG] Settings saved to DB:", result);
  return result;
};
