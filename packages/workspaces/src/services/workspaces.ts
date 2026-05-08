import type { IStoreAdapter } from '@fonderie-js/store';

import type { IWorkspace }    from '../types';

export async function findWorkspaceById(
	id:    string,
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [ row ] = await store.query<IWorkspace>(
		`SELECT
			id,
			name,
			slug,
			plan,
			owner_id    AS "ownerId",
			archived_at AS "archivedAt",
			created_at  AS "createdAt"
		FROM fonderie_workspaces
		WHERE id = $1
			AND archived_at IS NULL`,
		[id],
	)
	return row ?? null
}

export async function findWorkspacesByUserId(
	userId: string,
	store:  IStoreAdapter,
): Promise<IWorkspace[]> {
	return store.query<IWorkspace>(
		`SELECT
			w.id,
			w.name,
			w.slug,
			w.plan,
			w.owner_id    AS "ownerId",
			w.archived_at AS "archivedAt",
			w.created_at  AS "createdAt"
		FROM fonderie_workspaces w
		JOIN fonderie_workspace_members wm ON wm.workspace_id = w.id
		WHERE wm.user_id      = $1
			AND wm.deleted_at   IS NULL
			AND w.archived_at   IS NULL
		ORDER BY w.created_at ASC`,
		[userId],
	)
}

export async function createWorkspace(
	opts: { name: string; slug: string; ownerId: string; plan?: string },
	store: IStoreAdapter,
): Promise<IWorkspace> {
	const [workspace] = await store.query<IWorkspace>(
		`INSERT INTO fonderie_workspaces (name, slug, owner_id, plan)
			VALUES ($1, $2, $3, $4)
		RETURNING
			id, name, slug, plan,
			owner_id    AS "ownerId",
			archived_at AS "archivedAt",
			created_at  AS "createdAt"`,
		[opts.name, opts.slug, opts.ownerId, opts.plan ?? 'free'],
	)

	if (!workspace) {
		throw new Error('Failed to create workspace');
	}

	return workspace;
}
