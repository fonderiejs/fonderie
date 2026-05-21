-- fonderie_customer_label_type enum
CREATE TYPE fonderie_customer_label_type AS ENUM ('email', 'phone', 'address');

-- shared label catalog
CREATE TABLE IF NOT EXISTS fonderie_customer_labels (
	id         UUID                         PRIMARY KEY DEFAULT gen_random_uuid(),
	type       fonderie_customer_label_type NOT NULL,
	value      TEXT                         NOT NULL,
	created_at TIMESTAMPTZ                  NOT NULL DEFAULT now(),
	CONSTRAINT uq_fcl_type_value UNIQUE (type, value)
);

-- seed defaults
INSERT INTO fonderie_customer_labels (type, value) VALUES
	('email',   'work'),
	('email',   'personal'),
	('email',   'billing'),
	('phone',   'mobile'),
	('phone',   'office'),
	('phone',   'home'),
	('phone',   'fax'),
	('address', 'service'),
	('address', 'billing'),
	('address', 'other')
ON CONFLICT (type, value) DO NOTHING;

-- promote any non-standard values already stored in existing rows
INSERT INTO fonderie_customer_labels (type, value)
	SELECT DISTINCT 'email'::fonderie_customer_label_type, label
	FROM fonderie_customer_emails
	WHERE label IS NOT NULL
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO fonderie_customer_labels (type, value)
	SELECT DISTINCT 'phone'::fonderie_customer_label_type, label
	FROM fonderie_customer_phones
	WHERE label IS NOT NULL
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO fonderie_customer_labels (type, value)
	SELECT DISTINCT 'address'::fonderie_customer_label_type, label
	FROM fonderie_customer_addresses
	WHERE label IS NOT NULL
ON CONFLICT (type, value) DO NOTHING;

-- add label_id FK columns
ALTER TABLE fonderie_customer_emails
	ADD COLUMN IF NOT EXISTS label_id UUID REFERENCES fonderie_customer_labels(id);

ALTER TABLE fonderie_customer_phones
	ADD COLUMN IF NOT EXISTS label_id UUID REFERENCES fonderie_customer_labels(id);

ALTER TABLE fonderie_customer_addresses
	ADD COLUMN IF NOT EXISTS label_id UUID REFERENCES fonderie_customer_labels(id);

-- backfill label_id from existing label text
UPDATE fonderie_customer_emails e
	SET label_id = l.id
	FROM fonderie_customer_labels l
	WHERE l.type = 'email' AND l.value = e.label;

UPDATE fonderie_customer_phones p
	SET label_id = l.id
	FROM fonderie_customer_labels l
	WHERE l.type = 'phone' AND l.value = p.label;

UPDATE fonderie_customer_addresses a
	SET label_id = l.id
	FROM fonderie_customer_labels l
	WHERE l.type = 'address' AND l.value = a.label;

-- mark old text columns as deprecated
COMMENT ON COLUMN fonderie_customer_emails.label    IS 'deprecated: use label_id → fonderie_customer_labels';
COMMENT ON COLUMN fonderie_customer_phones.label    IS 'deprecated: use label_id → fonderie_customer_labels';
COMMENT ON COLUMN fonderie_customer_addresses.label IS 'deprecated: use label_id → fonderie_customer_labels';
