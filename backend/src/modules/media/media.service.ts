import cloudinary from "../../lib/cloudinary";
import prisma from "../../lib/prisma";

type ResourceType = "image" | "video";
type SortDirection = "asc" | "desc";

/** Every Cloudinary asset lives under this folder prefix (see lib/cloudinary.ts's
 * uploadImage) — scoping listMedia to it keeps the library to this app's own
 * uploads even if the Cloudinary account is ever shared with something else. */
const FOLDER_PREFIX = "bookstore/";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ListMediaParams = {
  resourceType: ResourceType;
  nextCursor?: string;
  /** "asc" = oldest first — the default, since finding old files to clean up is the point. */
  sort?: SortDirection;
  /** Both inclusive-ish, "YYYY-MM-DD". Silently ignored if not in that shape. */
  dateFrom?: string;
  dateTo?: string;
};

export const listMedia = async ({ resourceType, nextCursor, sort = "asc", dateFrom, dateTo }: ListMediaParams) => {
  const clauses = [`resource_type:${resourceType}`, `folder=${FOLDER_PREFIX}*`];
  if (dateFrom && DATE_RE.test(dateFrom)) clauses.push(`uploaded_at>${dateFrom}`);
  if (dateTo && DATE_RE.test(dateTo)) clauses.push(`uploaded_at<${dateTo}`);

  const result = await cloudinary.search
    .expression(clauses.join(" AND "))
    .sort_by("created_at", sort)
    .max_results(60)
    .next_cursor(nextCursor)
    .execute();

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
    totalCount: (result.total_count as number | undefined) ?? null,
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

/**
 * Deletes many assets in one go via Cloudinary's delete_resources — chunked to 100
 * ids per call (Cloudinary's own cap on that endpoint) even though callers today
 * never select more than one page (60) at a time.
 */
export const deleteMediaAssets = async (
  publicIds: string[],
  resourceType: ResourceType,
): Promise<{ deleted: string[]; notFound: string[] }> => {
  const deleted: string[] = [];
  const notFound: string[] = [];

  for (let i = 0; i < publicIds.length; i += 100) {
    const chunk = publicIds.slice(i, i + 100);
    const result = await cloudinary.api.delete_resources(chunk, { resource_type: resourceType });
    const statuses = result.deleted as Record<string, string>;
    for (const [id, status] of Object.entries(statuses)) {
      (status === "deleted" ? deleted : notFound).push(id);
    }
  }

  return { deleted, notFound };
};

/**
 * Cloudinary's account-wide usage for this billing cycle. On the Free plan storage,
 * bandwidth and transformations all draw from one shared "credits" pool rather than
 * having their own hard caps, so creditsUsedPercent is the number that actually
 * matters — storageBytes alone can look small while the account is still over quota.
 */
export const getUsage = async () => {
  const usage = await cloudinary.api.usage();
  return {
    plan:               usage.plan as string,
    storageBytes:       (usage.storage?.usage as number | undefined) ?? 0,
    bandwidthBytes:     (usage.bandwidth?.usage as number | undefined) ?? 0,
    resourceCount:      (usage.resources as number | undefined) ?? 0,
    creditsUsed:         usage.credits?.usage as number | undefined,
    creditsLimit:        usage.credits?.limit as number | undefined,
    creditsUsedPercent:  usage.credits?.used_percent as number | undefined,
    lastUpdated:         usage.last_updated as string | undefined,
  };
};
