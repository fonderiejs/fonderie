CREATE TABLE IF NOT EXISTS fonderie_workspaces (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name        TEXT NOT NULL,
	slug        TEXT NOT NULL,
	plan        TEXT NOT NULL DEFAULT 'free',
	owner_id    UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
	archived_at TIMESTAMPTZ,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonderie_roles (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name         TEXT NOT NULL,
	workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (name, workspace_id)
);

CREATE TABLE IF NOT EXISTS fonderie_workspace_members (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id      UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
	workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
	role_id      UUID NOT NULL REFERENCES fonderie_roles(id) ON DELETE CASCADE,
	deleted_at   TIMESTAMPTZ,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (user_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS fonderie_workspace_invitations (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
	email        TEXT NOT NULL,
	role_id      UUID NOT NULL REFERENCES fonderie_roles(id) ON DELETE CASCADE,
	pin          TEXT NOT NULL,
	expires_at   TIMESTAMPTZ NOT NULL,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS fonderie_role_permissions (
	role_id  UUID NOT NULL REFERENCES fonderie_roles(id) ON DELETE CASCADE,
	action   TEXT NOT NULL,
	resource TEXT NOT NULL,
	PRIMARY KEY (role_id, action, resource)
);

CREATE TABLE IF NOT EXISTS fonderie_courier_templates (
	type       TEXT PRIMARY KEY,
	subject    TEXT,
	html       TEXT,
	text       TEXT NOT NULL,
	active     BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
