-- The business profile a quote, an invoice or a customer email needs: legal
-- name, contact email, website, logo, tax registrations (GST/HST, QST, PST,
-- EIN, state sales-tax permits…), and the languages the business serves its
-- customers in.
ALTER TABLE fonderie_workspaces
  ADD COLUMN IF NOT EXISTS legal_name        TEXT,
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS website           TEXT,
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS tax_registrations JSONB  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS languages         TEXT[] NOT NULL DEFAULT '{}';
