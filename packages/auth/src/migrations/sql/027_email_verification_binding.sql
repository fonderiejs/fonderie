-- An email verification code now remembers the address it was sent to
-- (atomicity audit A19). Before, verifying marked whatever address the account
-- had AT THAT MOMENT as verified: change the email to A, then to B, or race a
-- resend with a change, and a code read in B's inbox verified A — an address
-- nobody proved. A code verifies only the address it was sent to.
--
-- Additive only: rows written before it have no address and keep working.
ALTER TABLE fonderie_email_verifications ADD COLUMN IF NOT EXISTS email TEXT;
