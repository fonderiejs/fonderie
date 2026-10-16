-- The business profile is stored once, on the default branch (release 9.0):
-- motto, industry, website, logo, tax registrations, and the primary email,
-- phone and head office address are the branch's. The copies the workspace
-- row carried — kept in step by hand since migration 011 — are dead, and so
-- is the typed branch domain: a branch's domain is its primary email's host.
--
-- Destructive on purpose (DROP COLUMN): apply only once every deployment
-- reads from the branch (@fonderie/workspaces 9.0.0 or later); the columns
-- cannot come back with their data.

-- Safety net: a workspace with no default branch yet (011 built one for every
-- row; an older importer may have added rows since) keeps its profile as its
-- default branch before the columns go. Its contact rows already belong to a
-- branch (011) — nothing else to move.
INSERT INTO fonderie_workspace_branches (workspace_id, name, motto, industry, website, logo_url, locale, tax_registrations, is_default)
SELECT w.id, w.name, w.motto, w.industry, w.website, w.logo_url,
       NULLIF(w.settings->>'locale', ''),
       COALESCE(w.tax_registrations, '[]'::jsonb), true
  FROM fonderie_workspaces w
 WHERE NOT EXISTS (SELECT 1 FROM fonderie_workspace_branches b WHERE b.workspace_id = w.id AND b.is_default);

ALTER TABLE fonderie_workspaces
  DROP COLUMN IF EXISTS motto,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS industry,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS website,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS tax_registrations;

DROP INDEX IF EXISTS ux_fwb_domain;
ALTER TABLE fonderie_workspace_branches DROP COLUMN IF EXISTS domain;
