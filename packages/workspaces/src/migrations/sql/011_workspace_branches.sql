-- A business has more than one face: the branches a customer deals with.
-- Each branch is one customer-facing identity — its name, logo, slogan,
-- sector, website, domain, language and tax registrations — and OWNS its
-- emails, phones and locations (one primary email / phone, one head office,
-- per branch). The workspace keeps the legal identity (legal name, legal
-- form, business number) and its name as the team's name.
--
-- fonderie_workspaces.motto / industry / website / logo_url /
-- tax_registrations / email / phone / address stay, as the MIRROR of the
-- DEFAULT branch — kept in step by the services, both ways — so code that
-- reads or writes those columns keeps working. The backfill makes every
-- workspace's current profile its default branch and moves every contact
-- row under it; a workspace with one branch behaves exactly as before.

CREATE TABLE IF NOT EXISTS fonderie_workspace_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  -- The host a funnel runs on ('quebecmover.com'): lower-cased, one live branch per host.
  domain TEXT CHECK (domain IS NULL OR (domain = lower(domain) AND length(domain) <= 253)),
  motto TEXT CHECK (motto IS NULL OR length(motto) <= 300),
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  -- BCP 47; NULL = the workspace's own language (settings).
  locale TEXT,
  tax_registrations JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  position SMALLINT NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (is_default AND archived_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwb_default ON fonderie_workspace_branches (workspace_id) WHERE is_default;
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwb_domain ON fonderie_workspace_branches (domain) WHERE domain IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fwb_workspace ON fonderie_workspace_branches (workspace_id) WHERE archived_at IS NULL;

-- Backfill: the workspace's profile becomes its default branch.
INSERT INTO fonderie_workspace_branches (workspace_id, name, motto, industry, website, logo_url, locale, tax_registrations, is_default)
SELECT w.id, w.name, w.motto, w.industry, w.website, w.logo_url,
       NULLIF(w.settings->>'locale', ''),
       COALESCE(w.tax_registrations, '[]'::jsonb), true
  FROM fonderie_workspaces w
 WHERE NOT EXISTS (SELECT 1 FROM fonderie_workspace_branches b WHERE b.workspace_id = w.id AND b.is_default);

-- Contacts belong to a branch.
ALTER TABLE fonderie_workspace_emails    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES fonderie_workspace_branches(id) ON DELETE CASCADE;
ALTER TABLE fonderie_workspace_phones    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES fonderie_workspace_branches(id) ON DELETE CASCADE;
ALTER TABLE fonderie_workspace_locations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES fonderie_workspace_branches(id) ON DELETE CASCADE;

UPDATE fonderie_workspace_emails e SET branch_id = b.id FROM fonderie_workspace_branches b
 WHERE e.branch_id IS NULL AND b.workspace_id = e.workspace_id AND b.is_default;
UPDATE fonderie_workspace_phones p SET branch_id = b.id FROM fonderie_workspace_branches b
 WHERE p.branch_id IS NULL AND b.workspace_id = p.workspace_id AND b.is_default;
UPDATE fonderie_workspace_locations l SET branch_id = b.id FROM fonderie_workspace_branches b
 WHERE l.branch_id IS NULL AND b.workspace_id = l.workspace_id AND b.is_default;

ALTER TABLE fonderie_workspace_emails    ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE fonderie_workspace_phones    ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE fonderie_workspace_locations ALTER COLUMN branch_id SET NOT NULL;

-- "One of each" is per branch now, not per workspace.
ALTER TABLE fonderie_workspace_emails DROP CONSTRAINT IF EXISTS fonderie_workspace_emails_workspace_id_email_key;
ALTER TABLE fonderie_workspace_emails ADD CONSTRAINT fonderie_workspace_emails_branch_id_email_key UNIQUE (branch_id, email);
DROP INDEX IF EXISTS ux_fwe_primary;
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwe_primary ON fonderie_workspace_emails (branch_id) WHERE is_primary;

ALTER TABLE fonderie_workspace_phones DROP CONSTRAINT IF EXISTS fonderie_workspace_phones_workspace_id_phone_extension_key;
ALTER TABLE fonderie_workspace_phones ADD CONSTRAINT fonderie_workspace_phones_branch_id_phone_extension_key UNIQUE (branch_id, phone, extension);
DROP INDEX IF EXISTS ux_fwp_primary;
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwp_primary ON fonderie_workspace_phones (branch_id) WHERE is_primary;

DROP INDEX IF EXISTS ux_fwl_head_office;
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwl_head_office ON fonderie_workspace_locations (branch_id) WHERE is_head_office;
CREATE INDEX IF NOT EXISTS idx_fwl_branch ON fonderie_workspace_locations (branch_id) WHERE archived_at IS NULL;
