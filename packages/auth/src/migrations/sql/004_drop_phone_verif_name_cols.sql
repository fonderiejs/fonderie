-- Drop columns added speculatively in 003 — user is created immediately
-- on registration so names never need to be carried in this table.
ALTER TABLE fonderie_phone_verifications
	DROP COLUMN IF EXISTS first_name,
	DROP COLUMN IF EXISTS last_name;
