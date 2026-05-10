-- Carry optional first/last name through the OTP flow so /auth/register
-- can accept them before the user record exists.
ALTER TABLE fonderie_phone_verifications
	ADD COLUMN IF NOT EXISTS first_name TEXT,
	ADD COLUMN IF NOT EXISTS last_name  TEXT;
