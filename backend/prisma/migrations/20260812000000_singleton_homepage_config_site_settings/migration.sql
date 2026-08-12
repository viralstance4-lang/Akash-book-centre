-- HomepageConfig and SiteSettings were being read/written via findFirst-then-
-- create/update in application code, which races: two concurrent saves (double
-- click, or two admins) can both see no/one existing row and both insert,
-- leaving duplicate rows where the next read silently picks an arbitrary one
-- and drops the other admin's changes.
--
-- Fix: re-key each table's row onto a fixed, well-known id and have the app
-- upsert against that id going forward (INSERT ... ON CONFLICT (id) DO UPDATE
-- is atomic at the DB level, unlike the old findFirst-then-branch logic).
--
-- If duplicates already exist in a given environment, keep only the most
-- recently updated row (the one most likely to reflect the last real save)
-- and drop the rest before re-keying. Both statement pairs are no-ops when the
-- table is empty or already has zero/one row at the target id.

-- ─── HomepageConfig ────────────────────────────────────────────────────────
DELETE FROM "HomepageConfig"
WHERE id NOT IN (
  SELECT id FROM "HomepageConfig" ORDER BY "updatedAt" DESC LIMIT 1
);

UPDATE "HomepageConfig"
SET id = '00000000-0000-0000-0000-000000000001'
WHERE id != '00000000-0000-0000-0000-000000000001';

-- ─── SiteSettings ──────────────────────────────────────────────────────────
DELETE FROM "SiteSettings"
WHERE id NOT IN (
  SELECT id FROM "SiteSettings" ORDER BY "updatedAt" DESC LIMIT 1
);

UPDATE "SiteSettings"
SET id = '00000000-0000-0000-0000-000000000002'
WHERE id != '00000000-0000-0000-0000-000000000002';
