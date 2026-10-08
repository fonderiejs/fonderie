-- The customer's own time zone (IANA, e.g. 'America/Toronto'): what times on
-- documents sent to them (quotes, invoices) are printed in. NULL: none set —
-- the business's zone (workspace settings.timezone) applies.
--
-- Additive and nullable: the code serving during a deploy neither reads nor
-- writes it.
ALTER TABLE fonderie_customers
	ADD COLUMN IF NOT EXISTS timezone TEXT;
