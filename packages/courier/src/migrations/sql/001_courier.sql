-- fonderie_courier_templates: per-type, per-locale message templates
CREATE TABLE IF NOT EXISTS fonderie_courier_templates (
	id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	type       TEXT        NOT NULL,
	locale     TEXT,                   -- NULL = default / catch-all locale
	subject    TEXT,
	html       TEXT,
	text       TEXT        NOT NULL,
	active     BOOLEAN     NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (type, locale)
);

CREATE INDEX IF NOT EXISTS idx_fct_type
	ON fonderie_courier_templates (type) WHERE active = true;

-- fonderie_message_log: audit trail of every dispatch attempt
CREATE TABLE IF NOT EXISTS fonderie_message_log (
	id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	message_type TEXT        NOT NULL,
	channel      TEXT        NOT NULL,
	recipient    TEXT        NOT NULL,
	locale       TEXT,
	status       TEXT        NOT NULL DEFAULT 'pending',
	error        TEXT,
	attempts     INT         NOT NULL DEFAULT 0,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	sent_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fml_type    ON fonderie_message_log (message_type);
CREATE INDEX IF NOT EXISTS idx_fml_status  ON fonderie_message_log (status);
CREATE INDEX IF NOT EXISTS idx_fml_created ON fonderie_message_log (created_at DESC);
