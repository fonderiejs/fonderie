-- The app's own resource. Everything else the starter needs — members, the
-- organization, billing, the activity feed — comes from Fonderie's own modules.
CREATE TABLE IF NOT EXISTS projects (
	id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id    uuid        NOT NULL,
	name            text        NOT NULL,
	description     text,
	status          text        NOT NULL DEFAULT 'active'
	                CHECK (status IN ('active', 'paused', 'completed', 'archived')),
	progress        smallint    NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
	owner_id        uuid        NOT NULL,
	member_ids      uuid[]      NOT NULL DEFAULT '{}',
	due_at          timestamptz,
	created_at      timestamptz NOT NULL DEFAULT now(),
	updated_at      timestamptz NOT NULL DEFAULT now()
);

-- The list screen sorts by updated_at within a workspace, which is what this
-- index serves. Without it, every list is a sequential scan once the table grows.
CREATE INDEX IF NOT EXISTS projects_workspace_updated_idx
	ON projects (workspace_id, updated_at DESC);
