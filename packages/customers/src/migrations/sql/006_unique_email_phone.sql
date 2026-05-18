-- Remove duplicate emails per customer, keeping the primary or the oldest row.
DELETE FROM fonderie_customer_emails
WHERE id NOT IN (
	SELECT DISTINCT ON (customer_id, email)
		id
	FROM fonderie_customer_emails
	ORDER BY customer_id, email, is_primary DESC, created_at ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fce_unique_email
	ON fonderie_customer_emails (customer_id, email);

-- Remove duplicate phones per customer, keeping the primary or the oldest row.
DELETE FROM fonderie_customer_phones
WHERE id NOT IN (
	SELECT DISTINCT ON (customer_id, phone)
		id
	FROM fonderie_customer_phones
	ORDER BY customer_id, phone, is_primary DESC, created_at ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcp_unique_phone
	ON fonderie_customer_phones (customer_id, phone);
