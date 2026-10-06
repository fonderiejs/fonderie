import { randomBytes } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

import type { ITaxRegistration, IWorkspace, IWorkspaceAddress, IWorkspaceSettings } from '../types';

const SELECT_WS = `
	id,
	name,
	slug,
	type,
	description,
	motto,
	phone,
	business_type AS "businessType",
	industry,
	address,
	legal_name AS "legalName",
	email,
	website,
	logo_url AS "logoUrl",
	tax_registrations AS "taxRegistrations",
	languages,
	plan,
	owner_id    AS "ownerId",
	is_personal AS "isPersonal",
	archived_at AS "archivedAt",
	archived_by AS "archivedBy",
	created_at  AS "createdAt",
	updated_at  AS "updatedAt"
`;

const SELECT_WS_W = `
	w.id,
	w.name,
	w.slug,
	w.type,
	w.description,
	w.motto,
	w.phone,
	w.business_type AS "businessType",
	w.industry,
	w.address,
	w.legal_name AS "legalName",
	w.email,
	w.website,
	w.logo_url AS "logoUrl",
	w.tax_registrations AS "taxRegistrations",
	w.languages,
	w.plan,
	w.owner_id    AS "ownerId",
	w.is_personal AS "isPersonal",
	w.archived_at AS "archivedAt",
	w.archived_by AS "archivedBy",
	w.created_at  AS "createdAt",
	w.updated_at  AS "updatedAt"
`;

export async function findWorkspaceById(
	id: string,
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [row] = await store.query<IWorkspace>(
		`SELECT ${SELECT_WS} FROM fonderie_workspaces WHERE id = $1`,
		[id],
	);
	return row ?? null;
}

/**
 * What withWorkspace needs in ONE round-trip: the workspace, whether `userId`
 * is an active member (the same predicate as getMember: a row neither removed
 * nor suspended), and the active SYSTEM roles they hold there — the input
 * requireManager matches its manager list against. Null when the workspace
 * does not exist. A null userId answers isMember false and no roles.
 */
export async function findWorkspaceAccess(
	workspaceId: string,
	userId: string | null,
	store: IStoreAdapter,
): Promise<{ workspace: IWorkspace; isMember: boolean; systemRoles: string[] } | null> {
	const [row] = await store.query<IWorkspace & { isMember: boolean; systemRoles: string[] | null }>(
		`SELECT ${SELECT_WS_W},
		        EXISTS (
		          SELECT 1 FROM fonderie_role_user_workspaces ruw
		           WHERE ruw.user_id      = $2
		             AND ruw.workspace_id = w.id
		             AND ruw.removed      = false
		             AND ruw.suspended    = false
		        ) AS "isMember",
		        ARRAY (
		          SELECT DISTINCT r.name
		            FROM fonderie_role_user_workspaces ruw
		            JOIN fonderie_roles r ON r.id = ruw.role_id
		           WHERE ruw.user_id      = $2
		             AND ruw.workspace_id = w.id
		             AND ruw.removed      = false
		             AND ruw.suspended    = false
		             AND r.is_system      = true
		             AND r.active         = true
		        ) AS "systemRoles"
		 FROM fonderie_workspaces w
		 WHERE w.id = $1`,
		[workspaceId, userId],
	);
	if (!row) return null;
	const { isMember, systemRoles, ...workspace } = row;
	return { workspace: workspace as IWorkspace, isMember: isMember === true, systemRoles: systemRoles ?? [] };
}

export async function findWorkspacesByUserId(
	userId: string,
	store: IStoreAdapter,
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
	);
}

export async function createWorkspace(
	opts: {
		name: string;
		slug: string;
		ownerId: string;
		type?: string;
		description?: string;
		plan?: string;
	},
	store: IStoreAdapter,
): Promise<IWorkspace> {
	// Slugs are unique among live workspaces, but names are not: two
	// businesses called "Acme Plumbing", or two whose name has no Latin letters
	// (水管公司 slugs to ''), must both be able to sign up. A taken slug gets a
	// short random suffix instead of failing the request with a 500.
	const base = opts.slug || 'workspace';
	for (let attempt = 0; attempt < 6; attempt++) {
		const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
		const [workspace] = await store.query<IWorkspace>(
			`INSERT INTO fonderie_workspaces (name, slug, owner_id, type, description, plan)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (slug) WHERE archived_at IS NULL DO NOTHING
			 RETURNING ${SELECT_WS}`,
			[
				opts.name,
				slug,
				opts.ownerId,
				opts.type ?? 'ORGANIZATION',
				opts.description ?? null,
				opts.plan ?? 'free',
			],
		);
		if (workspace) return workspace;
	}
	throw new Error('Failed to create workspace: no free slug');
}

// Returns the new workspace, or null if the personal workspace already exists (idempotent).
export async function createPersonalWorkspace(
	opts: { name: string; slug: string; ownerId: string },
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [workspace] = await store.query<IWorkspace>(
		`INSERT INTO fonderie_workspaces (name, slug, owner_id, type, is_personal)
		 VALUES ($1, $2, $3, 'PERSONAL', true)
		 ON CONFLICT (owner_id) WHERE is_personal = true DO NOTHING
		 RETURNING ${SELECT_WS}`,
		[opts.name, opts.slug, opts.ownerId],
	);
	return workspace ?? null;
}

export async function findPersonalWorkspace(
	userId: string,
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [row] = await store.query<IWorkspace>(
		`SELECT ${SELECT_WS} FROM fonderie_workspaces
		 WHERE owner_id = $1 AND is_personal = true
		 LIMIT 1`,
		[userId],
	);
	return row ?? null;
}

export async function updateWorkspace(
	id: string,
	opts: {
		name?: string;
		description?: string | null;
		slug?: string;
		motto?: string | null;
		phone?: string | null;
		businessType?: string | null;
		industry?: string | null;
		address?: IWorkspaceAddress | null;
		legalName?: string | null;
		email?: string | null;
		website?: string | null;
		logoUrl?: string | null;
		taxRegistrations?: ITaxRegistration[];
		languages?: string[];
	},
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const sets: string[] = ['updated_at = now()'];
	const params: unknown[] = [id];

	if (opts.name !== undefined) {
		params.push(opts.name);
		sets.push(`name = $${params.length}`);
	}
	if (opts.description !== undefined) {
		params.push(opts.description);
		sets.push(`description = $${params.length}`);
	}
	if (opts.slug !== undefined) {
		params.push(opts.slug);
		sets.push(`slug = $${params.length}`);
	}
	if (opts.motto !== undefined) {
		params.push(opts.motto);
		sets.push(`motto = $${params.length}`);
	}
	if (opts.phone !== undefined) {
		params.push(opts.phone);
		sets.push(`phone = $${params.length}`);
	}
	if (opts.businessType !== undefined) {
		params.push(opts.businessType);
		sets.push(`business_type = $${params.length}`);
	}
	if (opts.industry !== undefined) {
		params.push(opts.industry);
		sets.push(`industry = $${params.length}`);
	}
	if (opts.address !== undefined) {
		params.push(JSON.stringify(opts.address ?? {}));
		sets.push(`address = $${params.length}::jsonb`);
	}
	for (const [key, col] of [['legalName', 'legal_name'], ['email', 'email'], ['website', 'website'], ['logoUrl', 'logo_url']] as const) {
		if (opts[key] !== undefined) {
			params.push(opts[key]);
			sets.push(`${col} = $${params.length}`);
		}
	}
	if (opts.taxRegistrations !== undefined) {
		params.push(JSON.stringify(opts.taxRegistrations));
		sets.push(`tax_registrations = $${params.length}::jsonb`);
	}
	if (opts.languages !== undefined) {
		params.push(opts.languages);
		sets.push(`languages = $${params.length}::text[]`);
	}

	const [row] = await store.query<IWorkspace>(
		`UPDATE fonderie_workspaces
		 SET ${sets.join(', ')}
		 WHERE id = $1
		 RETURNING ${SELECT_WS}`,
		params,
	);
	return row ?? null;
}

export async function archiveWorkspace(
	id: string,
	byUser: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspaces
		 SET archived_at = now(), archived_by = $2, updated_at = now()
		 WHERE id = $1 AND archived_at IS NULL`,
		[id, byUser],
	);
}

export async function restoreWorkspace(id: string, store: IStoreAdapter): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspaces
		 SET archived_at = NULL, archived_by = NULL, updated_at = now()
		 WHERE id = $1`,
		[id],
	);
}

const SETTINGS_DEFAULTS: IWorkspaceSettings = {
	locale: 'en-US',
	timezone: 'UTC',
	currency: 'USD',
	dateFormat: 'MM/DD/YYYY',
	timeFormat: 'hh:mm A',
	documentPrefixes: {},
};

// Only string → string pairs survive a read: the map is shown and printed.
function prefixesOf(v: unknown): Record<string, string> {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
	return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0));
}

export async function getWorkspaceSettings(
	id: string,
	store: IStoreAdapter,
): Promise<IWorkspaceSettings> {
	const [row] = await store.query<{ settings: Record<string, unknown> }>(
		`SELECT settings FROM fonderie_workspaces WHERE id = $1`,
		[id],
	);
	const raw = row?.settings ?? {};
	const s = (raw['settings'] as Record<string, unknown> | undefined) ?? raw;

	return {
		locale: typeof s['locale'] === 'string' ? s['locale'] : SETTINGS_DEFAULTS.locale,
		timezone: typeof s['timezone'] === 'string' ? s['timezone'] : SETTINGS_DEFAULTS.timezone,
		currency: typeof s['currency'] === 'string' ? s['currency'] : SETTINGS_DEFAULTS.currency,
		dateFormat:
			typeof s['dateFormat'] === 'string' ? s['dateFormat'] : SETTINGS_DEFAULTS.dateFormat,
		timeFormat:
			typeof s['timeFormat'] === 'string' ? s['timeFormat'] : SETTINGS_DEFAULTS.timeFormat,
		documentPrefixes: prefixesOf(s['documentPrefixes']),
	};
}

export async function updateWorkspaceSettings(
	id: string,
	settings: Partial<Omit<IWorkspaceSettings, 'documentPrefixes'>> & { documentPrefixes?: Record<string, string> | null },
	store: IStoreAdapter,
): Promise<IWorkspaceSettings> {
	await store.query(
		`UPDATE fonderie_workspaces
		 -- Merge into the nested object: '||' at the top level replaced the
		 -- whole 'settings' key, so saving one setting erased the others.
		 SET settings   = jsonb_set(
		                    settings, '{settings}',
		                    COALESCE(settings->'settings', '{}'::jsonb) || $2::jsonb
		                  ),
		     updated_at = now()
		 WHERE id = $1`,
		[id, JSON.stringify(settings)],
	);
	return getWorkspaceSettings(id, store);
}
