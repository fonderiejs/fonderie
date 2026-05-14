-- fonderie_webhook_endpoints
CREATE TABLE IF NOT EXISTS fonderie_webhook_endpoints (
	id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id UUID        NOT NULL,
	url          TEXT        NOT NULL,
	secret       TEXT        NOT NULL,
	events       TEXT[]      NOT NULL DEFAULT '{}',
	enabled      BOOLEAN     NOT NULL DEFAULT true,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fwhe_workspace
	ON fonderie_webhook_endpoints (workspace_id)
	WHERE enabled = true;

-- fonderie_webhook_deliveries
CREATE TABLE IF NOT EXISTS fonderie_webhook_deliveries (
	id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	endpoint_id     UUID        NOT NULL REFERENCES fonderie_webhook_endpoints(id) ON DELETE CASCADE,
	event_id        TEXT        NOT NULL,
	event_type      TEXT        NOT NULL,
	payload         JSONB       NOT NULL,
	status          TEXT        NOT NULL DEFAULT 'pending',
	attempts        INT         NOT NULL DEFAULT 0,
	response_status INT,
	response_body   TEXT,
	next_attempt_at TIMESTAMPTZ,
	delivered_at    TIMESTAMPTZ,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fwhd_endpoint
	ON fonderie_webhook_deliveries (endpoint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fwhd_retry
	ON fonderie_webhook_deliveries (next_attempt_at)
	WHERE status = 'failed' AND next_attempt_at IS NOT NULL;
