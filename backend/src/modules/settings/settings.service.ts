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

  if (existing) {
    return prisma.siteSettings.update({ where: { id: existing.id }, data: updateData });
  }
  return prisma.siteSettings.create({
    data: {
      storeName: data.storeName ?? "BucketList Books",
      tagline: data.tagline ?? "",
      logoWidth: Number(data.logoWidth ?? 120),
      logoHeight: Number(data.logoHeight ?? 40),
      spiralBindingPrice: Number(data.spiralBindingPrice ?? 30),
      ...updateData,
    },
  });
};
