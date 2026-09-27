-- Where each session was opened from, filled only when the app supplies
-- IAuthConfig.location — the Active Sessions screen shows it next to the IP.
-- Same shape and sanitizing as fonderie_login_events.location. Nullable, no
-- backfill.
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS location JSONB;
