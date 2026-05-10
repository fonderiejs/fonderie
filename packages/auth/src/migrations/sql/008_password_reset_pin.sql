ALTER TABLE fonderie_password_resets RENAME COLUMN token TO pin;

DROP INDEX IF EXISTS idx_fonderie_password_resets_token;
CREATE INDEX IF NOT EXISTS idx_fonderie_password_resets_pin ON fonderie_password_resets (pin);
