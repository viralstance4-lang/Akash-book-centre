import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type SectionType = "banner" | "categories" | "newArrivals" | "featuredProducts" | "printSection" | "allBooks";

export interface SectionConfig {
  // categories section
  showAll?:             boolean;
  selectedCategoryIds?: string[];
  // newArrivals section
  categoryId?:          string;
  title?:               string;
  // featuredProducts section
  useManual?:           boolean;
  selectedProductIds?:  string[];
  // shared
  limit?:               number;
}

export interface HomepageSection {
  id:         string;
  type:       SectionType;
  title?:     string;
  categoryId?: string;
  enabled:    boolean;
  order:      number;
  config:     SectionConfig;
}

export interface HomepageConfigData {
  sections: HomepageSection[];
}

export const getHomepageConfig = async (): Promise<HomepageConfigData> => {
  const res = await api.get<ApiSuccessResponse<HomepageConfigData>>("/homepage-config");
  return res.data.data;
};

export const updateHomepageConfig = async (sections: HomepageSection[]): Promise<HomepageConfigData> => {
  console.log("[homepage.api] updateHomepageConfig called with", sections.length, "sections");
  try {
    const res = await api.put<ApiSuccessResponse<HomepageConfigData>>("/admin/homepage-config", { sections });
    console.log("[homepage.api] Update successful, response:", res.data);
    return res.data.data;
  } catch (err) {
    console.error("[homepage.api] Update failed:", err);
    throw err;
  }
};
