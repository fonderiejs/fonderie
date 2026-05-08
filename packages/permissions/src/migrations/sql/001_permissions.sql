-- fonderie_role_permissions: CRUD bit flags per role per resource key
CREATE TABLE IF NOT EXISTS fonderie_role_permissions (
	id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
	role_id        UUID         NOT NULL,
	workspace_id   UUID,
	permission_key TEXT         NOT NULL,
	can_create     BOOLEAN      NOT NULL DEFAULT false,
	can_read       BOOLEAN      NOT NULL DEFAULT false,
	can_update     BOOLEAN      NOT NULL DEFAULT false,
	can_delete     BOOLEAN      NOT NULL DEFAULT false,
	created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
	UNIQUE (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_frp_role_id        ON fonderie_role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_frp_workspace_id   ON fonderie_role_permissions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_frp_permission_key ON fonderie_role_permissions (permission_key);
