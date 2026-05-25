import AppError from "../../lib/AppError";
import { deleteImage, uploadImage } from "../../lib/cloudinary";
import prisma from "../../lib/prisma";

type FileLike = { buffer: Buffer };

export const getAllBanners = async (activeOnly = false) => {
  return prisma.banner.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { order: "asc" },
  });
};

export const createBanner = async (
  data: { redirectUrl: string; title?: string; isActive?: boolean; order?: number },
  desktopFile: FileLike,
  mobileFile: FileLike,
) => {
  const [desktop, mobile] = await Promise.all([
    uploadImage(desktopFile, "banners"),
    uploadImage(mobileFile, "banners"),
  ]);

  return prisma.banner.create({
    data: {
      // Keep legacy imageUrl pointing to desktop image for backward compat
      imageUrl: desktop.url,
      publicId: desktop.publicId,
      desktopImageUrl: desktop.url,
      desktopPublicId: desktop.publicId,
      mobileImageUrl: mobile.url,
      mobilePublicId: mobile.publicId,
      redirectUrl: data.redirectUrl,
      title: data.title,
      isActive: data.isActive ?? true,
      order: data.order ?? 0,
    },
  });
};

export const updateBanner = async (
  id: string,
  data: { redirectUrl?: string; title?: string; isActive?: boolean; order?: number },
  files?: { desktopFile?: FileLike; mobileFile?: FileLike },
) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new AppError("Banner not found", 404, "BANNER_NOT_FOUND");

  const updateData: Record<string, unknown> = { ...data };

  if (files?.desktopFile) {
    const uploaded = await uploadImage(files.desktopFile, "banners");
    updateData.desktopImageUrl = uploaded.url;
    updateData.desktopPublicId = uploaded.publicId;
    // Keep legacy field in sync with desktop image
    updateData.imageUrl = uploaded.url;
    updateData.publicId = uploaded.publicId;
    // Delete old desktop image from Cloudinary
    const oldDesktopId = banner.desktopPublicId ?? banner.publicId;
    if (oldDesktopId) await deleteImage(oldDesktopId).catch(() => {});
  }

  if (files?.mobileFile) {
    const uploaded = await uploadImage(files.mobileFile, "banners");
    updateData.mobileImageUrl = uploaded.url;
    updateData.mobilePublicId = uploaded.publicId;
    if (banner.mobilePublicId) await deleteImage(banner.mobilePublicId).catch(() => {});
  }

  return prisma.banner.update({ where: { id }, data: updateData });
};

export const deleteBanner = async (id: string) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new AppError("Banner not found", 404, "BANNER_NOT_FOUND");
  await prisma.banner.delete({ where: { id } });

  // Collect all Cloudinary public IDs to remove (avoid duplicates)
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const pid of [banner.desktopPublicId, banner.mobilePublicId, banner.publicId]) {
    if (pid && !seen.has(pid)) { seen.add(pid); toDelete.push(pid); }
  }
  await Promise.all(toDelete.map((pid) => deleteImage(pid).catch(() => {})));
};
