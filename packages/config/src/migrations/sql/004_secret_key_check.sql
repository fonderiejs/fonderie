-- Which key the stored secrets are under, without storing the key: one known
-- value encrypted with it. rotateSecretKey() writes it; setSecret() checks it
-- can decrypt it before writing. An instance still holding the old key after a
-- rotation is refused, instead of writing ciphertext nobody can read. A single
-- row (the CHECK pins id to true). Absent until the first rotation, and then
-- nothing is checked.

CREATE TABLE IF NOT EXISTS fonderie_secret_key_check (
  id          BOOLEAN     PRIMARY KEY DEFAULT true CHECK (id),
  check_value TEXT        NOT NULL,
  rotated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
