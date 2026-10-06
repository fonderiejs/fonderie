-- A phone sign-in code is the whole credential: it had no try limit of its
-- own, only a per-IP one, so guesses from many addresses went unbounded. Five
-- wrong tries now spend the code (as the account-deletion and step-up codes).
--
-- Additive only: the code serving during a deploy never reads it.
ALTER TABLE fonderie_phone_verifications ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
