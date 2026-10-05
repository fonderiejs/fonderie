-- A subscription set to end at the period's end BECAUSE its owner deleted their
-- account (not because they cancelled it themselves): restoring the account
-- resumes it; a cancellation the person chose stays (docs/ACCOUNT-DELETION-
-- DESIGN.md, D7). Additive, defaults false — the code serving during a deploy
-- never reads it.
ALTER TABLE fonderie_subscriptions
  ADD COLUMN IF NOT EXISTS ended_by_account_deletion BOOLEAN NOT NULL DEFAULT false;
