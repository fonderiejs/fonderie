-- Link phone verifications to a specific user so verify can be done by JWT alone
ALTER TABLE fonderie_phone_verifications
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES fonderie_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id
	ON fonderie_phone_verifications (user_id);
