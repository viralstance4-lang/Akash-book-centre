// This module has been removed. Genres is the single category system.
export const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
