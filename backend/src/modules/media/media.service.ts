import cloudinary from "../../lib/cloudinary";
import prisma from "../../lib/prisma";

type ResourceType = "image" | "video";

/** Every Cloudinary asset lives under this folder prefix (see lib/cloudinary.ts's
 * uploadImage) — scoping listMedia to it keeps the library to this app's own
 * uploads even if the Cloudinary account is ever shared with something else. */
const FOLDER_PREFIX = "bookstore/";

export const listMedia = async (resourceType: ResourceType, nextCursor?: string) => {
  const result = await cloudinary.api.resources({
    type: "upload",
    resource_type: resourceType,
    prefix: FOLDER_PREFIX,
    max_results: 60,
    next_cursor: nextCursor,
  });
  return {
    resources: result.resources as Array<{
      public_id: string;
      secure_url: string;
      resource_type: string;
      format: string;
      bytes: number;
      width?: number;
      height?: number;
      created_at: string;
    }>,
    nextCursor: (result.next_cursor as string | undefined) ?? null,
  };
};

/**
 * Every Cloudinary publicId currently referenced by a live DB record. Used to warn
 * an admin before they delete an asset that's still shown somewhere on the site —
 * deleting here only removes the Cloudinary file, it never touches these rows, so
 * an in-use deletion leaves a broken image behind instead of a crash.
 */
export const getInUsePublicIds = async (): Promise<Set<string>> => {
  const [books, bookImages, banners, categories, subcategories, categorySections, siteSettings] =
    await Promise.all([
      prisma.book.findMany({ select: { coverPublicId: true } }),
      prisma.bookImage.findMany({ select: { publicId: true } }),
      prisma.banner.findMany({ select: { publicId: true, desktopPublicId: true, mobilePublicId: true } }),
      prisma.category.findMany({ select: { imagePublicId: true } }),
      prisma.subcategory.findMany({ select: { imagePublicId: true } }),
      prisma.categorySection.findMany({ select: { imagePublicId: true } }),
      prisma.siteSettings.findFirst({ select: { logoPublicId: true } }),
    ]);

  const ids = new Set<string>();
  const add = (v?: string | null) => { if (v) ids.add(v); };

  books.forEach((b) => add(b.coverPublicId));
  bookImages.forEach((b) => add(b.publicId));
  banners.forEach((b) => { add(b.publicId); add(b.desktopPublicId); add(b.mobilePublicId); });
  categories.forEach((c) => add(c.imagePublicId));
  subcategories.forEach((s) => add(s.imagePublicId));
  categorySections.forEach((c) => add(c.imagePublicId));
  add(siteSettings?.logoPublicId);

  return ids;
};

export const deleteMediaAsset = async (publicId: string, resourceType: ResourceType): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
