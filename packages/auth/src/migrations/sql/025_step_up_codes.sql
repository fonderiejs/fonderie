-- Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): before a big move —
-- handing a team over, ending a plan at once, adding a webhook that receives
-- every event — the signed-in person proves it is still them. An account
-- without a password or two-factor proves it with a code sent to its email or
-- phone; this holds that code (hashed, five tries, ten minutes).
--
-- Additive only: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_step_up_codes (
  user_id    UUID        PRIMARY KEY REFERENCES fonderie_users(id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  channel    TEXT        NOT NULL CHECK (channel IN ('email', 'sms')),
  attempts   INT         NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
