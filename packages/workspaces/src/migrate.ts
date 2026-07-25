import type { IStoreAdapter } from '@fonderie/store';

// Migrating existing teams/orgs onto Fonderie workspaces. Like `importUser` in
// @fonderie/auth, the runtime `create*` paths are for fresh workspaces (new id,
// default timestamps); a migration must instead **preserve identity** so the
// membership join and any app-owned foreign keys still resolve.
//
// A faithful workspaces migration is two steps:
//   1. `importWorkspace` — the workspace row (preserve id, ownerId, createdAt).
//   2. `importMembership` — the user↔workspace↔role join, once the users
//      (`importUser`) and workspaces exist. Resolve `roleId` from the seeded
//      system roles (`SELECT id FROM fonderie_roles WHERE name=$1 AND is_system`)
//      or from a custom role you imported.

export interface IImportWorkspace {
	// Preserve the legacy id (UUID) so memberships + app FKs still point here.
	id?: string;
	name: string;
	slug: string;
	// The owning user's id — must match the imported user (see `importUser`).
	ownerId: string;
	type?: string;
	plan?: string;
	description?: string | null;
	settings?: Record<string, unknown>; // jsonb
	isPersonal?: boolean;
	// Organization-profile fields (migration 003), all optional.
	motto?: string | null;
	phone?: string | null;
	businessType?: string | null;
	address?: Record<string, unknown>; // jsonb
	// Preserve the original creation time; omitted defaults to now().
	createdAt?: Date;
	archivedAt?: Date | null;
	archivedBy?: string | null;
}

// Insert one migrated workspace, preserving whichever fields are supplied and
// letting the table defaults fill the rest. Returns the row's id.
export async function importWorkspace(
	store: IStoreAdapter,
	ws: IImportWorkspace,
): Promise<{ id: string }> {
	const cols: string[] = [];
	const vals: unknown[] = [];
	const placeholders: string[] = [];
	const add = (col: string, val: unknown) => {
		cols.push(col);
		vals.push(val);
		placeholders.push(`$${vals.length}`);
	};

	if (ws.id !== undefined) add('id', ws.id);
	add('name', ws.name);
	add('slug', ws.slug);
	add('owner_id', ws.ownerId);
	if (ws.type !== undefined) add('type', ws.type);
	if (ws.plan !== undefined) add('plan', ws.plan);
	if (ws.description !== undefined) add('description', ws.description);
	if (ws.settings !== undefined) add('settings', JSON.stringify(ws.settings));
	if (ws.isPersonal !== undefined) add('is_personal', ws.isPersonal);
	if (ws.motto !== undefined) add('motto', ws.motto);
	if (ws.phone !== undefined) add('phone', ws.phone);
	if (ws.businessType !== undefined) add('business_type', ws.businessType);
	if (ws.address !== undefined) add('address', JSON.stringify(ws.address));
	if (ws.createdAt !== undefined) add('created_at', ws.createdAt);
	if (ws.archivedAt !== undefined) add('archived_at', ws.archivedAt);
	if (ws.archivedBy !== undefined) add('archived_by', ws.archivedBy);

	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_workspaces (${cols.join(', ')})
		 VALUES (${placeholders.join(', ')})
		 RETURNING id`,
		vals,
	);
	if (!row) throw new Error('[workspaces] importWorkspace: insert returned no row');
	return row;
}

export interface IImportRole {
	// Preserve the legacy id so imported memberships (`importMembership`) can
	// reference it. Omit to let the table generate one.
	id?: string;
	name: string;
	// Custom roles are workspace-scoped. (The system roles — ADMIN, GUEST — are
	// seeded with a NULL workspace_id; don't import those, resolve them by name.)
	workspaceId: string;
	description?: string | null;
	active?: boolean;
	createdAt?: Date;
}

// Insert one custom (workspace-scoped) role, preserving its id so memberships
// resolve. `is_system` stays false (system roles are seeded, not imported).
export async function importRole(
	store: IStoreAdapter,
	role: IImportRole,
): Promise<{ id: string }> {
	const cols: string[] = [];
	const vals: unknown[] = [];
	const placeholders: string[] = [];
	const add = (col: string, val: unknown) => {
		cols.push(col);
		vals.push(val);
		placeholders.push(`$${vals.length}`);
	};

	if (role.id !== undefined) add('id', role.id);
	add('name', role.name);
	add('workspace_id', role.workspaceId);
	if (role.description !== undefined) add('description', role.description);
	if (role.active !== undefined) add('active', role.active);
	if (role.createdAt !== undefined) add('created_at', role.createdAt);

	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_roles (${cols.join(', ')})
		 VALUES (${placeholders.join(', ')})
		 RETURNING id`,
		vals,
	);
	if (!row) throw new Error('[workspaces] importRole: insert returned no row');
	return row;
}

export interface IImportMembership {
	userId: string;
	workspaceId: string;
	// A role id — resolve from the seeded system roles or a custom imported role.
	roleId: string;
	// Whether the membership is active/accepted. Default true (a migrated member
	// is already a member; pending invitations migrate separately).
	confirmed?: boolean;
	createdAt?: Date;
}

// Insert one user↔workspace↔role membership. Replay-safe: a repeated import of
// the same (user, workspace, role) is a no-op.
export async function importMembership(
	store: IStoreAdapter,
	m: IImportMembership,
): Promise<void> {
	const cols = ['user_id', 'workspace_id', 'role_id', 'confirmed'];
	const vals: unknown[] = [m.userId, m.workspaceId, m.roleId, m.confirmed ?? true];
	if (m.createdAt !== undefined) {
		cols.push('created_at');
		vals.push(m.createdAt);
	}
	const placeholders = vals.map((_, i) => `$${i + 1}`);

	await store.query(
		`INSERT INTO fonderie_role_user_workspaces (${cols.join(', ')})
		 VALUES (${placeholders.join(', ')})
		 ON CONFLICT (user_id, workspace_id, role_id) DO NOTHING`,
		vals,
	);
}
