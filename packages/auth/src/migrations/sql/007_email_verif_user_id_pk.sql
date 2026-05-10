-- Swap primary key from token to user_id so concurrent users can share the
-- same 6-digit PIN without colliding.  Deduplicate first (keep newest row per
-- user) in case stale data exists, then promote user_id to PK.

DELETE FROM fonderie_email_verifications e1
USING fonderie_email_verifications e2
WHERE e1.user_id = e2.user_id
  AND e1.created_at < e2.created_at;

ALTER TABLE fonderie_email_verifications
    DROP CONSTRAINT fonderie_email_verifications_pkey;

ALTER TABLE fonderie_email_verifications
    ADD PRIMARY KEY (user_id);
