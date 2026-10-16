import { randomBytes } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

import { ensureDefaultBranch, profileToDefaultBranch } from './branches';
import { fromProfile } from './contacts';

import type { ITaxRegistration, IWorkspace, IWorkspaceAddress, IWorkspaceSettings } from '../types';

// A workspace row holds what belongs to the TEAM: its name, slug, type,
// description, legal identity (legal name, legal form, languages), plan and
// archive state. The customer-facing profile — motto, industry, website,
// logo, tax registrations, email, phone, address — is the DEFAULT BRANCH's
// (migration 011) and its primary contacts: it is READ from there, never
// copied onto the workspace row (migration 012 dropped the copies).

/** The workspace's own columns, `w` being fonderie_workspaces. */
const OWN_COLS = `
	w.id,
	w.name,
	w.slug,
	w.type,
	w.description,
	w.business_type AS "businessType",
	w.legal_name AS "legalName",
	w.languages,
	w.plan,
	w.owner_id    AS "ownerId",
	w.is_personal AS "isPersonal",
	w.archived_at AS "archivedAt",
	w.archived_by AS "archivedBy",
	w.created_at  AS "createdAt",
	w.updated_at  AS "updatedAt"
`;

/** The profile, from the default branch joined as `d` (see PROFILE_JOIN). */
const PROFILE_COLS = `
	d.motto,
	d.phone,
	d.industry,
	d.address,
	d.email,
	d.website,
	d.logo_url AS "logoUrl",
	d.tax_registrations AS "taxRegistrations"
`;

/** A brand-new row: no branch yet, so an empty profile. */
const EMPTY_PROFILE_COLS = `
	NULL::text AS motto,
	NULL::text AS phone,
	NULL::text AS industry,
	NULL::jsonb AS address,
	NULL::text AS email,
	NULL::text AS website,
	NULL::text AS "logoUrl",
	NULL::jsonb AS "taxRegistrations"
`;

const SELECT_WS_W = `${OWN_COLS}, ${PROFILE_COLS}`;

/**
 * The default branch and its primary email, primary phone and head office,
 * one row per workspace (`LATERAL`, so it reads as columns of `w`). A
 * workspace without a default branch yet — one older than migration 011's
 * backfill, before its first contact write creates it — shows an empty profile.
 */
const PROFILE_JOIN = `
	LEFT JOIN LATERAL (
	  SELECT b.motto, b.industry, b.website, b.logo_url, b.tax_registrations,
	         (SELECT e.email FROM fonderie_workspace_emails e WHERE e.branch_id = b.id AND e.is_primary LIMIT 1) AS email,
	         (SELECT p.phone FROM fonderie_workspace_phones p WHERE p.branch_id = b.id AND p.is_primary LIMIT 1) AS phone,
	         (SELECT l.address FROM fonderie_workspace_locations l WHERE l.branch_id = b.id AND l.is_head_office LIMIT 1) AS address
	    FROM fonderie_workspace_branches b
	   WHERE b.workspace_id = w.id AND b.is_default
	) d ON true
`;

export async function findWorkspaceById(
	id: string,
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [row] = await store.query<IWorkspace>(
		`SELECT ${SELECT_WS_W} FROM fonderie_workspaces w ${PROFILE_JOIN} WHERE w.id = $1`,
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
		 FROM fonderie_workspaces w ${PROFILE_JOIN}
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
	// Membership as a subquery (not a join): a member with two roles has two
	// rows there, and the profile columns cannot be grouped by the id.
	return store.query<IWorkspace>(
		`SELECT ${SELECT_WS_W}
		 FROM fonderie_workspaces w ${PROFILE_JOIN}
		 WHERE w.id IN (
		   SELECT ruw.workspace_id FROM fonderie_role_user_workspaces ruw
		    WHERE ruw.user_id   = $1
		      AND ruw.removed   = false
		      AND ruw.suspended = false
		 )
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
			 RETURNING ${OWN_COLS.replace(/\bw\./g, '')}, ${EMPTY_PROFILE_COLS}`,
			[
				opts.name,
				slug,
				opts.ownerId,
				opts.type ?? 'ORGANIZATION',
				opts.description ?? null,
				opts.plan ?? 'free',
			],
		);
		if (workspace) {
			// Every workspace has a default branch from the start (migration 011).
			await ensureDefaultBranch(store, workspace.id);
			return workspace;
		}
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
		 RETURNING ${OWN_COLS.replace(/\bw\./g, '')}, ${EMPTY_PROFILE_COLS}`,
		[opts.name, opts.slug, opts.ownerId],
	);
	if (workspace) await ensureDefaultBranch(store, workspace.id);
	return workspace ?? null;
}

export async function findPersonalWorkspace(
	userId: string,
	store: IStoreAdapter,
): Promise<IWorkspace | null> {
	const [row] = await store.query<IWorkspace>(
		`SELECT ${SELECT_WS_W} FROM fonderie_workspaces w ${PROFILE_JOIN}
		 WHERE w.owner_id = $1 AND w.is_personal = true
		 LIMIT 1`,
		[userId],
	);
	return row ?? null;
}

/**
 * The workspace's own fields land on its row; the profile fields go where
 * they live — motto / industry / website / logoUrl / taxRegistrations on the
 * default branch, email / phone / address as its primary email, primary phone
 * and head office (created when there is none). Call inside a transaction
 * when more than one of those is given. A profile value that cannot be
 * stored (a phone that is not E.164, a full list) is refused with a
 * ContactError / BranchError — nothing is dropped on the floor. Resolves to
 * the workspace as it now reads, or null when there is no such workspace.
 */
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
	if (opts.businessType !== undefined) {
		params.push(opts.businessType);
		sets.push(`business_type = $${params.length}`);
	}
	if (opts.legalName !== undefined) {
		params.push(opts.legalName);
		sets.push(`legal_name = $${params.length}`);
	}
	if (opts.languages !== undefined) {
		params.push(opts.languages);
		sets.push(`languages = $${params.length}::text[]`);
	}

	const [row] = await store.query<{ id: string }>(
		`UPDATE fonderie_workspaces
		 SET ${sets.join(', ')}
		 WHERE id = $1
		 RETURNING id`,
		params,
	);
	if (!row) return null;

	await profileToDefaultBranch(store, id, { motto: opts.motto, industry: opts.industry, website: opts.website, logoUrl: opts.logoUrl, taxRegistrations: opts.taxRegistrations });
	await fromProfile(store, id, { email: opts.email, phone: opts.phone, address: opts.address });
	return findWorkspaceById(id, store);
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
