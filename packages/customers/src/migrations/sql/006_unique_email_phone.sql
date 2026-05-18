CREATE UNIQUE INDEX IF NOT EXISTS idx_fce_unique_email
	ON fonderie_customer_emails (customer_id, email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcp_unique_phone
	ON fonderie_customer_phones (customer_id, phone);
