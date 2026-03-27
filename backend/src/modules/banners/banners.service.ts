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
  file: FileLike,
) => {
  const uploaded = await uploadImage(file, "banners");
  return prisma.banner.create({
    data: {
      imageUrl: uploaded.url,
      publicId: uploaded.publicId,
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
) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new AppError("Banner not found", 404, "BANNER_NOT_FOUND");
  return prisma.banner.update({ where: { id }, data });
};

export const deleteBanner = async (id: string) => {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new AppError("Banner not found", 404, "BANNER_NOT_FOUND");
  await prisma.banner.delete({ where: { id } });
  await deleteImage(banner.publicId);
};
