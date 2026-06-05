import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type SectionType = "banner" | "categories" | "newArrivals" | "featuredProducts" | "printSection" | "allBooks";

export interface SectionConfig {
  // categories section
  showAll?:               boolean;
  selectedCategoryIds?:   string[];
  // newArrivals section
  categoryId?:            string;
  subcategoryId?:         string;
  selectedSubcategoryIds?: string[];
  title?:                 string;
  // featuredProducts section
  useManual?:             boolean;
  selectedProductIds?:    string[];
  // shared
  limit?:                 number;
}

export interface HomepageSection {
  id:          string;
  type:        SectionType;
  title?:      string;
  categoryId?: string;
  enabled:     boolean;
  order:       number;
  config:      SectionConfig;
}

export interface HomepageConfigData {
  sections: HomepageSection[];
}

export const getHomepageConfig = async (): Promise<HomepageConfigData> => {
  const res = await api.get<ApiSuccessResponse<HomepageConfigData>>("/homepage-config");
  return res.data.data;
};

export const updateHomepageConfig = async (sections: HomepageSection[]): Promise<HomepageConfigData> => {
  const res = await api.put<ApiSuccessResponse<HomepageConfigData>>("/admin/homepage-config", { sections });
  return res.data.data;
};
