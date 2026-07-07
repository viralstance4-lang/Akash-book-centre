import type { Category } from "../api/categories.api";
import type { HomepageSection } from "../api/homepage-sections.api";

export interface CategorySectionItem {
  id:       string;
  name:     string;
  slug:     string;
  imageUrl?: string | null;
  href:     string;
}

/**
 * Resolve the "View all" destination for any homepage section.
 *
 * Centralizing this logic means new categories/subcategories/collections
 * automatically get a working "View all" link without any code changes —
 * the route is derived from the section's own configuration (category,
 * subcategory, or book filter), never hardcoded by name.
 */
export function getSectionViewAllHref(section: HomepageSection, categories: Category[]): string {
  if (section.type === "allBooks") return "/all-books";

  if (section.type === "categories") return "/categories";

  if (section.type === "books") {
    const cat = section.categoryId ? categories.find((c) => c.id === section.categoryId) : undefined;
    const sub = section.subcategoryId ? cat?.subcategories.find((s) => s.id === section.subcategoryId) : undefined;

    if (sub) return `/subcategory/${sub.slug}`;
    if (cat) return `/category/${cat.slug}`;

    switch (section.bookFilter) {
      case "featured":    return "/featured";
      case "bestSellers": return "/best-sellers";
      default:            return "/all-books";
    }
  }

  return "/all-books";
}

/**
 * Resolve the cards a "categories" homepage section should display.
 *
 * - No categories selected (admin left it empty) -> browse all active categories,
 *   same as before.
 * - Categories selected (via the picker, or a legacy single `categoryId`) -> for
 *   each selected category, show its active subcategories (mode "subcategories"
 *   or "auto" with subcategories present), or the category itself otherwise
 *   (mode "categories", or "auto"/"subcategories" with no subcategories — so a
 *   section never ends up empty just because a category has none yet).
 *
 * New categories/subcategories created later are picked up automatically since
 * everything is derived from the live `categories` list, never hardcoded.
 */
export function getCategorySectionItems(section: HomepageSection, categories: Category[]): CategorySectionItem[] {
  const cfg   = section.config;
  const limit = cfg.limit ?? 8;

  const selectedIds = cfg.selectedCategoryIds?.length
    ? cfg.selectedCategoryIds
    : section.categoryId ? [section.categoryId] : [];

  if (!selectedIds.length) {
    return categories
      .filter((c) => c.isActive)
      .slice(0, limit)
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, href: `/category/${c.slug}` }));
  }

  const displayMode = cfg.displayMode ?? "auto";
  const items: CategorySectionItem[] = [];

  for (const id of selectedIds) {
    const cat = categories.find((c) => c.id === id && c.isActive);
    if (!cat) continue;

    const activeSubs = cat.subcategories.filter((s) => s.isActive);
    const showSubs   = displayMode !== "categories" && activeSubs.length > 0;

    if (showSubs) {
      items.push(...activeSubs.map((s) => ({
        id: s.id, name: s.name, slug: s.slug, imageUrl: s.imageUrl, href: `/subcategory/${s.slug}`,
      })));
    } else {
      items.push({ id: cat.id, name: cat.name, slug: cat.slug, imageUrl: cat.imageUrl, href: `/category/${cat.slug}` });
    }
  }

  return items.slice(0, limit);
}
