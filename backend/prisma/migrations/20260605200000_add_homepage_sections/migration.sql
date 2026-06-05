-- CreateTable: dynamic homepage sections
CREATE TABLE "HomepageSection" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "title"         VARCHAR(255) NOT NULL,
    "subtitle"      VARCHAR(255),
    "description"   TEXT,
    "type"          VARCHAR(50)  NOT NULL DEFAULT 'books',
    "layoutType"    VARCHAR(50)  NOT NULL DEFAULT 'horizontal',
    "bookFilter"    VARCHAR(50)  NOT NULL DEFAULT 'newArrivals',
    "categoryId"    UUID,
    "subcategoryId" UUID,
    "isEnabled"     BOOLEAN      NOT NULL DEFAULT true,
    "order"         INTEGER      NOT NULL DEFAULT 0,
    "config"        JSONB        NOT NULL DEFAULT '{}',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomepageSection_order_idx"     ON "HomepageSection"("order");
CREATE INDEX "HomepageSection_isEnabled_idx" ON "HomepageSection"("isEnabled");

-- Seed default sections (migrate from old HomepageConfig JSON)
INSERT INTO "HomepageSection" ("title","type","layoutType","bookFilter","isEnabled","order","config","updatedAt") VALUES
  ('Banner Slider',       'banner',     'horizontal', 'newArrivals', true, 1, '{}',                                                              CURRENT_TIMESTAMP),
  ('Browse by Category',  'categories', 'horizontal', 'newArrivals', true, 2, '{"showAll":true,"selectedCategoryIds":[],"limit":8}',             CURRENT_TIMESTAMP),
  ('New Arrivals',        'books',      'horizontal', 'newArrivals', true, 3, '{"limit":6,"title":"New Arrivals"}',                              CURRENT_TIMESTAMP),
  ('Featured Books',      'books',      'horizontal', 'featured',    true, 4, '{"limit":4,"useManual":false,"selectedProductIds":[]}',           CURRENT_TIMESTAMP),
  ('Print CTA',           'printCta',   'horizontal', 'newArrivals', true, 5, '{}',                                                              CURRENT_TIMESTAMP),
  ('All Books',           'allBooks',   'grid',       'all',         true, 6, '{}',                                                              CURRENT_TIMESTAMP);
