import prisma from "../../lib/prisma";
import type { HomepageSection } from "./homepage-config.schema";

/** The baseline config served when no record exists in the database yet */
const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: "banner",          type: "banner",          enabled: true,  order: 1, config: {} },
  { id: "categories",      type: "categories",      enabled: true,  order: 2, config: { showAll: true, selectedCategoryIds: [], limit: 8 } },
  { id: "newArrivals",     type: "newArrivals",     title: "New Arrivals", enabled: true,  order: 3, categoryId: undefined, config: { categoryId: "", title: "New Arrivals", limit: 6 } },
  { id: "featuredProducts",type: "featuredProducts",enabled: true,  order: 4, config: { useManual: false, selectedProductIds: [], limit: 4 } },
  { id: "printSection",    type: "printSection",    enabled: true,  order: 5, config: {} },
  { id: "allBooks",        type: "allBooks",        enabled: true,  order: 6, config: {} },
];

/**
 * HomepageConfig is a singleton table — every read/write targets this fixed id
 * (set by migration 20260812000000_singleton_homepage_config_site_settings)
 * so concurrent saves upsert the same row instead of racing to create two.
 */
const HOMEPAGE_CONFIG_ID = "00000000-0000-0000-0000-000000000001";

/** In-process cache: avoids a DB hit on every homepage render */
let cache: { sections: HomepageSection[]; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

export const getHomepageConfig = async (): Promise<{ sections: HomepageSection[] }> => {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return { sections: cache.sections };
  }

  let record = null;
  try {
    record = await prisma.homepageConfig.findUnique({ where: { id: HOMEPAGE_CONFIG_ID } });
  } catch {
    // Table may not exist yet if migration hasn't been run — return defaults
    return { sections: DEFAULT_SECTIONS };
  }

  const rawSections = record ? (record.sections as HomepageSection[]) : [];
  const sections = rawSections.length > 0 ? rawSections : DEFAULT_SECTIONS;
  cache = { sections, cachedAt: Date.now() };
  return { sections };
};

export const updateHomepageConfig = async (sections: HomepageSection[]): Promise<{ sections: HomepageSection[] }> => {
  // Ensure orders are sequential starting from 1
  const ordered = [...sections].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));

  // Atomic at the DB level (INSERT ... ON CONFLICT (id) DO UPDATE) — two
  // concurrent saves both upsert the same fixed-id row instead of one of them
  // creating a duplicate that silently shadows the other's changes.
  const updated = await prisma.homepageConfig.upsert({
    where:  { id: HOMEPAGE_CONFIG_ID },
    update: { sections: ordered as any },
    create: { id: HOMEPAGE_CONFIG_ID, sections: ordered as any },
  });

  // Bust cache
  cache = { sections: updated.sections as HomepageSection[], cachedAt: Date.now() };
  return { sections: updated.sections as HomepageSection[] };
};
