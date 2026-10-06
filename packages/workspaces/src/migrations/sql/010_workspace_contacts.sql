-- A business has more than one way to be reached and more than one place:
-- several emails and phones (one primary each) and its locations (one head
-- office). fonderie_workspaces.email / phone / address stay, as the MIRROR of
-- the primary email, the primary phone and the head office's address — kept
-- in step by the service in the same transaction, both ways — so code that
-- reads or writes those columns keeps working.
--
-- The backfill turns each workspace's existing email / phone (when already
-- E.164) / address into its first entry.

CREATE TABLE IF NOT EXISTS fonderie_workspace_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email) AND length(email) <= 254),
  label TEXT CHECK (label IS NULL OR length(label) <= 100),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwe_primary ON fonderie_workspace_emails (workspace_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS fonderie_workspace_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  extension TEXT CHECK (extension IS NULL OR extension ~ '^[0-9]{1,8}$'),
  label TEXT CHECK (label IS NULL OR length(label) <= 100),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone, extension)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwp_primary ON fonderie_workspace_phones (workspace_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS fonderie_workspace_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  country TEXT GENERATED ALWAYS AS (address->>'country') STORED,
  tax_region TEXT CHECK (tax_region IS NULL OR tax_region ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  phone TEXT CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$'),
  email TEXT CHECK (email IS NULL OR email = lower(email)),
  is_head_office BOOLEAN NOT NULL DEFAULT false,
  position SMALLINT NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (is_head_office AND archived_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fwl_head_office ON fonderie_workspace_locations (workspace_id) WHERE is_head_office;
CREATE INDEX IF NOT EXISTS idx_fwl_workspace ON fonderie_workspace_locations (workspace_id) WHERE archived_at IS NULL;

-- Backfill
INSERT INTO fonderie_workspace_emails (workspace_id, email, is_primary)
SELECT id, lower(email), true FROM fonderie_workspaces WHERE email IS NOT NULL AND email <> '' ON CONFLICT DO NOTHING;
INSERT INTO fonderie_workspace_phones (workspace_id, phone, is_primary)
SELECT id, phone, true FROM fonderie_workspaces WHERE phone ~ '^\+[1-9][0-9]{6,14}$' ON CONFLICT DO NOTHING;
INSERT INTO fonderie_workspace_locations (workspace_id, name, address, tax_region, is_head_office)
SELECT id, 'Head office', address,
       -- A state stored before addresses were normalized ('Québec') is not a
       -- code: leave tax_region empty rather than fail the CHECK.
       CASE WHEN address->>'country' IN ('CA','US') AND upper(coalesce(address->>'state','')) ~ '^[A-Z0-9]{1,3}$'
            THEN (address->>'country') || '-' || upper(address->>'state') END, true
  FROM fonderie_workspaces WHERE address IS NOT NULL AND address <> '{}'::jsonb ON CONFLICT DO NOTHING;
