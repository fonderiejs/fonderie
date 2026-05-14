-- Add is_personal flag to fonderie_workspaces
ALTER TABLE fonderie_workspaces
	ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

-- One personal workspace per user — enforced at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_fw_personal_owner
	ON fonderie_workspaces (owner_id)
	WHERE is_personal = true;
