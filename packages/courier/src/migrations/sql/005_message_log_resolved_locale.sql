-- The version actually sent, beside the locale that was asked for. With
-- fallback chains the two differ (asked fr-BE, sent fr-CA), and for copy that
-- carries legal terms "which version did this user receive?" needs a stored
-- answer, not a reconstruction from today's config.
ALTER TABLE fonderie_message_log
	ADD COLUMN IF NOT EXISTS resolved_locale TEXT;
