-- The sector / trade the business works in, as the app's own key
-- ('plumbing', 'moving'). Additive and nullable: code that predates it never
-- reads or writes it. The buzzer code (address.accessCode), tax rates
-- (tax_registrations[].rate) and document prefixes (settings.documentPrefixes)
-- live in existing JSONB columns and need no DDL.
ALTER TABLE fonderie_workspaces
  ADD COLUMN IF NOT EXISTS industry TEXT;
