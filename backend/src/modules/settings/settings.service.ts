import prisma from "../../lib/prisma";
import { uploadImage, deleteImage } from "../../lib/cloudinary";

/**
 * SiteSettings is a singleton table — every read/write targets this fixed id
 * (set by migration 20260812000000_singleton_homepage_config_site_settings)
 * so concurrent saves upsert the same row instead of racing to create two.
 */
const SITE_SETTINGS_ID = "00000000-0000-0000-0000-000000000002";

export const getSettings = async () => prisma.siteSettings.findUnique({ where: { id: SITE_SETTINGS_ID } });

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
  const existing = await prisma.siteSettings.findUnique({ where: { id: SITE_SETTINGS_ID } });
  const updateData: any = {};

  if (data.storeName !== undefined) updateData.storeName = data.storeName;
  if (data.tagline !== undefined) updateData.tagline = data.tagline;
  if (data.logoWidth !== undefined) updateData.logoWidth = Number(data.logoWidth);
  if (data.logoHeight !== undefined) updateData.logoHeight = Number(data.logoHeight);
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

  // Atomic at the DB level (INSERT ... ON CONFLICT (id) DO UPDATE) — two
  // concurrent saves (e.g. a logo upload racing a text-field save) both upsert
  // the same fixed-id row instead of one creating a duplicate that shadows
  // the other's changes.
  const result = await prisma.siteSettings.upsert({
    where:  { id: SITE_SETTINGS_ID },
    update: updateData,
    create: {
      id: SITE_SETTINGS_ID,
      storeName: data.storeName ?? "Akash Book Centre",
      tagline: data.tagline ?? "",
      logoWidth: Number(data.logoWidth ?? 120),
      logoHeight: Number(data.logoHeight ?? 40),
      spiralBindingPrice: Number(data.spiralBindingPrice ?? 30),
      ...updateData,
    },
  });
  return result;
};
