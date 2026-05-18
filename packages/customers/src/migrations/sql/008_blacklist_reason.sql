ALTER TABLE fonderie_customers
	ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
