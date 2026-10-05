-- One PENDING invitation per (workspace, address), whatever the case.
--
-- The old index on (workspace_id, email) was not UNIQUE, so the "already
-- pending → refresh it" branch of createInvitation never ran: re-inviting the
-- same person stacked a second invitation (and a second email, and a second
-- reserved seat) beside the first.
--
-- Existing duplicates: keep the newest pending invitation per address and
-- cancel the rest, then enforce the rule.

UPDATE fonderie_workspace_invitations i
SET status = 'CANCELLED'
WHERE i.status = 'PENDING'
  AND EXISTS (
    SELECT 1 FROM fonderie_workspace_invitations n
    WHERE n.workspace_id = i.workspace_id
      AND lower(n.email) = lower(i.email)
      AND n.status = 'PENDING'
      AND (n.created_at, n.id) > (i.created_at, i.id)
  );

UPDATE fonderie_workspace_invitations SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fwi_one_pending
	ON fonderie_workspace_invitations (workspace_id, lower(email))
	WHERE status = 'PENDING';
