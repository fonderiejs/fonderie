import type { IStoreAdapter } from '@fonderie-js/store';

import type { IWorkspace, IWorkspaceSettings } from '../types';

const SELECT_WS = `
	id,
	name,
	slug,
	type,
	description,
	plan,
	owner_id    AS "ownerId",
	is_personal AS "isPersonal",
	archived_at AS "archivedAt",
	archived_by AS "archivedBy",
	created_at  AS "createdAt",
	updated_at  AS "updatedAt"
`

const SELECT_WS_W = `
	w.id,
	w.name,
	w.slug,
	w.type,
	w.description,
	w.plan,
	w.owner_id    AS "ownerId",
	w.is_personal AS "isPersonal",
	w.archived_at AS "archivedAt",
	w.archived_by AS "archivedBy",
	w.created_at  AS "createdAt",
	w.updated_at  AS "updatedAt"
`

export async function findWorkspaceById(
	id:    string,
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [row] = await store.query<IWorkspace>(
		`SELECT ${SELECT_WS} FROM fonderie_workspaces WHERE id = $1`,
		[id],
	)
	return row ?? null
}

export async function findWorkspacesByUserId(
	userId: string,
	store:  IStoreAdapter,
): Promise<IWorkspace[]> {
	return store.query<IWorkspace>(
		`SELECT ${SELECT_WS_W}
		 FROM fonderie_workspaces w
		 JOIN fonderie_role_user_workspaces ruw ON ruw.workspace_id = w.id
		 WHERE ruw.user_id   = $1
		   AND ruw.removed   = false
		   AND ruw.suspended = false
		 GROUP BY w.id
		 ORDER BY w.created_at ASC`,
		[userId],
	)
}

export async function createWorkspace(
	opts: {
		name:         string
		slug:         string
		ownerId:      string
		type?:        string
		description?: string
		plan?:        string
	},
	store: IStoreAdapter,
): Promise<IWorkspace> {
	const [workspace] = await store.query<IWorkspace>(
		`INSERT INTO fonderie_workspaces (name, slug, owner_id, type, description, plan)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING ${SELECT_WS}`,
		[opts.name, opts.slug, opts.ownerId, opts.type ?? 'ORGANIZATION', opts.description ?? null, opts.plan ?? 'free'],
	)

	if (!workspace) throw new Error('Failed to create workspace')
	return workspace
}

// Returns the new workspace, or null if the personal workspace already exists (idempotent).
export async function createPersonalWorkspace(
	opts:  { name: string; slug: string; ownerId: string },
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [workspace] = await store.query<IWorkspace>(
		`INSERT INTO fonderie_workspaces (name, slug, owner_id, type, is_personal)
		 VALUES ($1, $2, $3, 'PERSONAL', true)
		 ON CONFLICT (owner_id) WHERE is_personal = true DO NOTHING
		 RETURNING ${SELECT_WS}`,
		[opts.name, opts.slug, opts.ownerId],
	)
	return workspace ?? null
}

export async function findPersonalWorkspace(
	userId: string,
	store:  IStoreAdapter,
): Promise<IWorkspace | null> {
	const [row] = await store.query<IWorkspace>(
		`SELECT ${SELECT_WS} FROM fonderie_workspaces
		 WHERE owner_id = $1 AND is_personal = true
		 LIMIT 1`,
		[userId],
	)
	return row ?? null
}

export async function updateWorkspace(
	id:    string,
	opts:  { name?: string; description?: string | null; slug?: string },
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const sets: string[]   = ['updated_at = now()']
	const params: unknown[] = [id]

	if (opts.name !== undefined) {
		params.push(opts.name);  sets.push(`name = $${params.length}`)
	}
	if (opts.description !== undefined) {
		params.push(opts.description); sets.push(`description = $${params.length}`)
	}
	if (opts.slug !== undefined) {
		params.push(opts.slug); sets.push(`slug = $${params.length}`)
	}

	const [row] = await store.query<IWorkspace>(
		`UPDATE fonderie_workspaces
		 SET ${sets.join(', ')}
		 WHERE id = $1
		 RETURNING ${SELECT_WS}`,
		params,
	)
	return row ?? null
}

export async function archiveWorkspace(
	id:     string,
	byUser: string,
	store:  IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspaces
		 SET archived_at = now(), archived_by = $2, updated_at = now()
		 WHERE id = $1 AND archived_at IS NULL`,
		[id, byUser],
	)
}

export async function restoreWorkspace(
	id:    string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspaces
		 SET archived_at = NULL, archived_by = NULL, updated_at = now()
		 WHERE id = $1`,
		[id],
	)
}

const SETTINGS_DEFAULTS: IWorkspaceSettings = {
	locale: 'en-US', timezone: 'UTC',
	currency: 'USD', dateFormat: 'MM/DD/YYYY', timeFormat: 'hh:mm A',
}

export async function getWorkspaceSettings(
	id:    string,
	store: IStoreAdapter,
): Promise<IWorkspaceSettings> {
	const [row] = await store.query<{ settings: Record<string, unknown> }>(
		`SELECT settings FROM fonderie_workspaces WHERE id = $1`,
		[id],
	)
	const raw = row?.settings ?? {}
	const s   = (raw['settings'] as Record<string, unknown> | undefined) ?? raw

	return {
		locale:     typeof s['locale']     === 'string' ? s['locale']     : SETTINGS_DEFAULTS.locale,
		timezone:   typeof s['timezone']   === 'string' ? s['timezone']   : SETTINGS_DEFAULTS.timezone,
		currency:   typeof s['currency']   === 'string' ? s['currency']   : SETTINGS_DEFAULTS.currency,
		dateFormat: typeof s['dateFormat'] === 'string' ? s['dateFormat'] : SETTINGS_DEFAULTS.dateFormat,
		timeFormat: typeof s['timeFormat'] === 'string' ? s['timeFormat'] : SETTINGS_DEFAULTS.timeFormat,
	}
}

export async function updateWorkspaceSettings(
	id:       string,
	settings: Partial<IWorkspaceSettings>,
	store:    IStoreAdapter,
): Promise<IWorkspaceSettings> {
	await store.query(
		`UPDATE fonderie_workspaces
		 SET settings   = settings || jsonb_build_object('settings', $2::jsonb),
		     updated_at = now()
		 WHERE id = $1`,
		[id, JSON.stringify(settings)],
	)
	return getWorkspaceSettings(id, store)
}
