-- Unit number on shared addresses table
ALTER TABLE fonderie_addresses
	ADD COLUMN IF NOT EXISTS unit TEXT;

-- Links two customers with a typed, directional relationship
CREATE TABLE IF NOT EXISTS fonderie_customer_relationships (
	id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id UUID        NOT NULL,
	customer_id  UUID        NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	related_id   UUID        NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE,
	relationship TEXT        NOT NULL,
	is_primary   BOOLEAN     NOT NULL DEFAULT false,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (customer_id, related_id)
);

CREATE INDEX IF NOT EXISTS idx_fcrel_customer
	ON fonderie_customer_relationships (customer_id);

CREATE INDEX IF NOT EXISTS idx_fcrel_related
	ON fonderie_customer_relationships (related_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcrel_primary
	ON fonderie_customer_relationships (customer_id)
	WHERE is_primary = true;
