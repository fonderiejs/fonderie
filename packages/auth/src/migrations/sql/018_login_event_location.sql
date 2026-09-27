-- Optional location for each login attempt (and registration), filled only when the app supplies
-- IAuthConfig.location. JSONB rather than columns: resolvers differ in
-- what they know (edge headers give country/region/city; an IP-intelligence
-- API adds ISP/ASN/proxy), and auth sanitizes the shape before writing.
-- Nullable, no default, no backfill: existing rows simply have no location.
ALTER TABLE fonderie_login_events ADD COLUMN IF NOT EXISTS location JSONB;
