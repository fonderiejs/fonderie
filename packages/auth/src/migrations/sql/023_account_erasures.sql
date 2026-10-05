-- Evidence that an account was erased (docs/ACCOUNT-DELETION-DESIGN.md, D8):
-- when it was requested, reminded and erased, and what each brick did — with
-- NO personal data. The email / phone are kept only as keyed hashes (HMAC with
-- the app's secret), so an operator can answer "was the account of x@y erased,
-- and when?" without the table identifying anyone by itself.
CREATE TABLE IF NOT EXISTS fonderie_account_erasures (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE,
  email_hash   TEXT,
  phone_hash   TEXT,
  requested_at TIMESTAMPTZ,
  reminded_at  TIMESTAMPTZ,
  erased_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcomes     JSONB       NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_fonderie_account_erasures_erased_at ON fonderie_account_erasures (erased_at);
