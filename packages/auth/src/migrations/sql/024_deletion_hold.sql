-- The operator's side of account deletion (docs/ACCOUNT-DELETION-DESIGN.md,
-- Phase 5). A LEGAL HOLD stops the scheduler from reminding or erasing an
-- archived account (a dispute, a court order, a fraud investigation) until an
-- operator lifts it; the reason says why, for the next operator and the
-- auditor. A receipt records who erased the account: the schedule on its date,
-- or an operator acting on an urgent verified request ("erase now").
--
-- Additive only: the code serving during a deploy never reads these.
ALTER TABLE fonderie_users ADD COLUMN IF NOT EXISTS deletion_hold_at     TIMESTAMPTZ;
ALTER TABLE fonderie_users ADD COLUMN IF NOT EXISTS deletion_hold_reason TEXT;
ALTER TABLE fonderie_account_erasures ADD COLUMN IF NOT EXISTS initiated_by TEXT NOT NULL DEFAULT 'schedule';
