-- fonderie_customers
CREATE TABLE IF NOT EXISTS fonderie_customers (
	id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id   UUID        NOT NULL,
	type           TEXT        NOT NULL DEFAULT 'individual',
	first_name     TEXT,
	last_name      TEXT,
	company_name   TEXT,
	job_title      TEXT,
	avatar_url     TEXT,
	locale         TEXT        NOT NULL DEFAULT 'en-US',
	reference_code TEXT,
	is_archived    BOOLEAN     NOT NULL DEFAULT false,
	created_by     UUID,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fc_workspace
	ON fonderie_customers (workspace_id);

CREATE INDEX IF NOT EXISTS idx_fc_workspace_archived
	ON fonderie_customers (workspace_id, is_archived);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fc_reference_code
	ON fonderie_customers (workspace_id, reference_code)
	WHERE reference_code IS NOT NULL;

-- fonderie_addresses (shared; created IF NOT EXISTS so another package can also define it)
CREATE TABLE IF NOT EXISTS fonderie_addresses (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	country_iso      TEXT NOT NULL,
	subdivision1_iso TEXT,
	subdivision2_iso TEXT,
	zip_postal_code  TEXT NOT NULL,
	line1            TEXT,
	line2            TEXT
);

-- fonderie_customer_emails
CREATE TABLE IF NOT EXISTS fonderie_customer_emails (
	id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	customer_id UUID        NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	email       TEXT        NOT NULL,
	label       TEXT        NOT NULL DEFAULT 'work',
	is_primary  BOOLEAN     NOT NULL DEFAULT false,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fce_customer
	ON fonderie_customer_emails (customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fce_primary
	ON fonderie_customer_emails (customer_id)
	WHERE is_primary = true;

-- fonderie_customer_phones
CREATE TABLE IF NOT EXISTS fonderie_customer_phones (
	id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	customer_id UUID        NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	phone       TEXT        NOT NULL,
	label       TEXT        NOT NULL DEFAULT 'mobile',
	is_primary  BOOLEAN     NOT NULL DEFAULT false,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcp_customer
	ON fonderie_customer_phones (customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcp_primary
	ON fonderie_customer_phones (customer_id)
	WHERE is_primary = true;

-- fonderie_customer_addresses (junction)
CREATE TABLE IF NOT EXISTS fonderie_customer_addresses (
	addr_id     UUID NOT NULL REFERENCES fonderie_addresses(id) ON DELETE CASCADE,
	customer_id UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	label       TEXT NOT NULL DEFAULT 'service',
	is_primary  BOOLEAN NOT NULL DEFAULT false,
	PRIMARY KEY (addr_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_fca_customer
	ON fonderie_customer_addresses (customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fca_primary
	ON fonderie_customer_addresses (customer_id)
	WHERE is_primary = true;

-- fonderie_customer_notes
CREATE TABLE IF NOT EXISTS fonderie_customer_notes (
	id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	customer_id UUID        NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	author_id   UUID,
	body        TEXT        NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcn_customer
	ON fonderie_customer_notes (customer_id);

-- fonderie_customer_tags
CREATE TABLE IF NOT EXISTS fonderie_customer_tags (
	customer_id UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	tag         TEXT NOT NULL,
	PRIMARY KEY (customer_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_fct_tag
	ON fonderie_customer_tags (tag);
