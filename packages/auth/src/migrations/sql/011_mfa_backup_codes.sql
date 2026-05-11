CREATE TABLE IF NOT EXISTS fonderie_mfa_backup_codes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
    code_hash  TEXT        NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonderie_mfa_backup_codes_user_id
    ON fonderie_mfa_backup_codes (user_id);
