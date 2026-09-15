/**
 * Inserts a Cloudinary transform (auto format + auto quality, optionally capped
 * to a max width) into an existing delivery URL, so images are fetched already
 * sized/compressed for how big they're actually rendered instead of at their
 * original upload resolution. Only `w_` is given (no crop mode) so Cloudinary
 * scales proportionally — never distorted or cropped differently than CSS
 * already crops it.
 *
 * Pass no `width` (e.g. for a click-to-zoom view) to keep full resolution while
 * still getting the auto format/quality compression win.
 *
 * URLs that aren't Cloudinary's (S3, Open Library seed covers, etc.) pass through
 * unchanged.
 */
export function optimizeImage(url: string | null | undefined, width?: number): string {
  if (!url) return url ?? "";
  if (!url.includes("res.cloudinary.com")) return url;

  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const insertAt = i + marker.length;
  const transform = width ? `f_auto,q_auto,w_${width}` : "f_auto,q_auto";
  return `${url.slice(0, insertAt)}${transform}/${url.slice(insertAt)}`;
}
