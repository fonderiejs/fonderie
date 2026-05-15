-- Extend fonderie_message_log for delivery event correlation
ALTER TABLE fonderie_message_log
	ADD COLUMN IF NOT EXISTS provider             TEXT,
	ADD COLUMN IF NOT EXISTS provider_message_id  TEXT,
	ADD COLUMN IF NOT EXISTS opened_at            TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS clicked_at           TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS bounced_at           TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS bounce_reason        TEXT;

CREATE INDEX IF NOT EXISTS idx_fml_provider_msg_id
	ON fonderie_message_log (provider_message_id)
	WHERE provider_message_id IS NOT NULL;
