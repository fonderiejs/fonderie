-- fonderie_workspaces
CREATE TABLE IF NOT EXISTS fonderie_workspaces (
	id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	name        TEXT        NOT NULL,
	slug        TEXT        NOT NULL,
	type        TEXT        NOT NULL DEFAULT 'ORGANIZATION',
	description TEXT,
	plan        TEXT        NOT NULL DEFAULT 'free',
	owner_id    UUID        NOT NULL,
	settings    JSONB       NOT NULL DEFAULT '{}',
	archived_at TIMESTAMPTZ,
	archived_by UUID,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fw_slug
	ON fonderie_workspaces (slug) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fw_owner
	ON fonderie_workspaces (owner_id);

-- fonderie_roles
CREATE TABLE IF NOT EXISTS fonderie_roles (
	id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	name         TEXT        NOT NULL,
	workspace_id UUID,
	is_system    BOOLEAN     NOT NULL DEFAULT false,
	active       BOOLEAN     NOT NULL DEFAULT true,
	description  TEXT,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fr_name_ws
	ON fonderie_roles (name, workspace_id) WHERE workspace_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fr_name_system
	ON fonderie_roles (name) WHERE workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fr_workspace
	ON fonderie_roles (workspace_id);

-- Seed system roles
INSERT INTO fonderie_roles (name, workspace_id, is_system, description)
VALUES
	('ADMIN', NULL, true, 'System administrator with full access'),
	('GUEST', NULL, true, 'Guest user with read-only access')
ON CONFLICT DO NOTHING;

-- fonderie_role_user_workspaces: one row per (user, workspace, role) assignment
CREATE TABLE IF NOT EXISTS fonderie_role_user_workspaces (
	user_id      UUID        NOT NULL,
	workspace_id UUID        NOT NULL,
	role_id      UUID        NOT NULL,
	confirmed    BOOLEAN     NOT NULL DEFAULT false,
	removed      BOOLEAN     NOT NULL DEFAULT false,
	suspended    BOOLEAN     NOT NULL DEFAULT false,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, workspace_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_fruw_user_ws
	ON fonderie_role_user_workspaces (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_fruw_workspace
	ON fonderie_role_user_workspaces (workspace_id);

-- fonderie_workspace_invitations
CREATE TABLE IF NOT EXISTS fonderie_workspace_invitations (
	id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id UUID        NOT NULL,
	email        TEXT        NOT NULL,
	role_id      UUID        NOT NULL,
	token        TEXT        UNIQUE,
	pin          TEXT,
	status       TEXT        NOT NULL DEFAULT 'PENDING',
	expires_at   TIMESTAMPTZ NOT NULL,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fwi_ws_email
	ON fonderie_workspace_invitations (workspace_id, email) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_fwi_token
	ON fonderie_workspace_invitations (token) WHERE token IS NOT NULL;
