-- Workspace-scope customer labels. The table is a SHARED vocabulary: an
-- unconditional list exposed every tenant's custom label values, and delete
-- was global (harm-reduced earlier to unreferenced-only). Add an optional
-- workspace_id: NULL = a shared/system default (the seeded rows keep NULL),
-- non-null = a label private to one workspace.
ALTER TABLE fonderie_customer_labels ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- The old global UNIQUE(type,value) blocked two workspaces from having the
-- same custom (type,value). Replace it with two partial unique indexes:
-- shared defaults are unique per (type,value); workspace labels are unique
-- per (type,value,workspace_id).
ALTER TABLE fonderie_customer_labels DROP CONSTRAINT IF EXISTS uq_fcl_type_value;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fcl_shared
	ON fonderie_customer_labels (type, value)
	WHERE workspace_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fcl_scoped
	ON fonderie_customer_labels (type, value, workspace_id)
	WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fcl_workspace ON fonderie_customer_labels (workspace_id);
