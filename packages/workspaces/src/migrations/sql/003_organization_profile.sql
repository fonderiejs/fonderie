ALTER TABLE fonderie_workspaces
  ADD COLUMN IF NOT EXISTS motto          TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS business_type  TEXT,
  ADD COLUMN IF NOT EXISTS address        JSONB NOT NULL DEFAULT '{}';
