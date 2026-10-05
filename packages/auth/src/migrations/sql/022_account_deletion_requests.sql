-- Account deletion with proof (docs/ACCOUNT-DELETION-DESIGN.md, Phase 2): the
-- one-time code a person confirms deletion with, sent to the verified channel
-- they chose, and that channel on the archived account (later notices — the
-- reminder, the final notice — go the same way).
--
-- Additive only: the code serving during a deploy never reads these.
CREATE TABLE IF NOT EXISTS fonderie_account_deletion_codes (
  user_id    UUID        PRIMARY KEY REFERENCES fonderie_users(id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  channel    TEXT        NOT NULL CHECK (channel IN ('email', 'sms')),
  attempts   INT         NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fonderie_users ADD COLUMN IF NOT EXISTS deletion_channel     TEXT;
ALTER TABLE fonderie_users ADD COLUMN IF NOT EXISTS deletion_reminded_at TIMESTAMPTZ;
