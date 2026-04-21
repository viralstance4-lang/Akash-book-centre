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

/** In-process cache: avoids a DB hit on every homepage render */
let cache: { sections: HomepageSection[]; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

export const getHomepageConfig = async (): Promise<{ sections: HomepageSection[] }> => {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return { sections: cache.sections };
  }

  let record = null;
  try {
    record = await prisma.homepageConfig.findFirst();
  } catch {
    // Table may not exist yet if migration hasn't been run — return defaults
    return { sections: DEFAULT_SECTIONS };
  }

  const sections = record ? (record.sections as HomepageSection[]) : DEFAULT_SECTIONS;
  cache = { sections, cachedAt: Date.now() };
  return { sections };
};

export const updateHomepageConfig = async (sections: HomepageSection[]): Promise<{ sections: HomepageSection[] }> => {
  // Ensure orders are sequential starting from 1
  const ordered = [...sections].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));

  console.log("[HomepageConfigService] updateHomepageConfig: received", sections.length, "sections");
  console.log("[HomepageConfigService] Reordered sections:", JSON.stringify(ordered, null, 2));

  const existing = await prisma.homepageConfig.findFirst();
  console.log("[HomepageConfigService] Existing record:", existing?.id ? `id=${existing.id}` : "none, creating new");
  
  let updated;
  if (existing) {
    console.log("[HomepageConfigService] Updating existing record...");
    updated = await prisma.homepageConfig.update({ where: { id: existing.id }, data: { sections: ordered as any } });
    console.log("[HomepageConfigService] Update complete, new data:", JSON.stringify(updated.sections, null, 2));
  } else {
    console.log("[HomepageConfigService] Creating new record...");
    updated = await prisma.homepageConfig.create({ data: { sections: ordered as any } });
    console.log("[HomepageConfigService] Create complete, new data:", JSON.stringify(updated.sections, null, 2));
  }

  // Bust cache
  cache = { sections: updated.sections as HomepageSection[], cachedAt: Date.now() };
  return { sections: updated.sections as HomepageSection[] };
};
