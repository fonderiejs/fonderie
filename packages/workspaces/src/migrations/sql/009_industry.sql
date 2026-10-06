-- The sector / trade the business works in, as the app's own key
-- ('plumbing', 'moving'). Additive and nullable: code that predates it never
-- reads or writes it. The buzzer code (address.accessCode), tax rates
-- (tax_registrations[].rate) and document prefixes (settings.documentPrefixes)
-- live in existing JSONB columns and need no DDL.
ALTER TABLE fonderie_workspaces
  ADD COLUMN IF NOT EXISTS industry TEXT;

-- The same rule the API applies (lowercase key, 1–40 of a-z 0-9 _ -), so a
-- row written around the API cannot hold what the API would refuse.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fonderie_workspaces_industry_key') THEN
    ALTER TABLE fonderie_workspaces
      ADD CONSTRAINT fonderie_workspaces_industry_key CHECK (industry IS NULL OR industry ~ '^[a-z0-9_-]{1,40}$');
  END IF;
END $$;
