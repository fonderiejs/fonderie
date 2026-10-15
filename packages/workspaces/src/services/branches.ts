import type { IStoreAdapter } from '@fonderie/store';

import type { ITaxRegistration, IWorkspaceBranch } from '../types';

// A workspace's branches (migration 011): one customer-facing identity each,
// one of them the default. The default branch's identity (motto, industry,
// website, logo, tax registrations) and its primary contacts ARE the
// workspace's profile: services/workspaces.ts reads them from here (one
// LATERAL join), nothing copies them onto fonderie_workspaces. The profile
// columns that row still carries from migration 005 are dead — read only by
// ensureDefaultBranch / defaultBranchId, to build the default branch of a
// row older than 011's backfill — and go with a later migration.
//
// Every write locks the workspace row first (FOR UPDATE), so two requests at
// once cannot both become "the first branch" or race the default flag.

export const BRANCH_LIMIT = 20;

/** A refusal the controller turns into a response. */
export class BranchError extends Error {
	constructor(
		readonly status: 404 | 409 | 422,
		readonly reason: string,
		message: string,
	) {
		super(message);
	}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `b` is fonderie_workspace_branches. The domain is not stored: it is the
// host of the branch's primary email ('bureau@quebecmover.com' →
// 'quebecmover.com'), so it can never disagree with how the branch is reached.
export const BRANCH_COLS = `b.id, b.workspace_id AS "workspaceId", b.name,
	(SELECT lower(split_part(e.email, '@', 2)) FROM fonderie_workspace_emails e WHERE e.branch_id = b.id AND e.is_primary LIMIT 1) AS domain,
	b.motto, b.industry, b.website, b.logo_url AS "logoUrl",
	b.locale, b.tax_registrations AS "taxRegistrations", b.is_default AS "isDefault", b.position,
	b.archived_at AS "archivedAt", b.archived_by AS "archivedBy", b.created_at AS "createdAt", b.updated_at AS "updatedAt"`;

export interface IBranchInput {
	name?: string;
	motto?: string | null;
	industry?: string | null;
	website?: string | null;
	logoUrl?: string | null;
	locale?: string | null;
	taxRegistrations?: ITaxRegistration[];
	isDefault?: boolean;
	position?: number;
}

export async function lockWorkspace(tx: IStoreAdapter, workspaceId: string): Promise<void> {
	await tx.query(`SELECT 1 FROM fonderie_workspaces WHERE id = $1 FOR UPDATE`, [workspaceId]);
}

export async function getBranch(tx: IStoreAdapter, workspaceId: string, id: string): Promise<IWorkspaceBranch | null> {
	if (!UUID.test(id)) return null;
	const [row] = await tx.query<IWorkspaceBranch>(`SELECT ${BRANCH_COLS} FROM fonderie_workspace_branches b WHERE b.workspace_id = $1 AND b.id = $2`, [workspaceId, id]);
	return row ?? null;
}

/** A new workspace's default branch, from its profile — one statement, nothing read back (a fake store in a unit test returns nothing). */
export async function ensureDefaultBranch(store: IStoreAdapter, workspaceId: string): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_workspace_branches (workspace_id, name, motto, industry, website, logo_url, locale, tax_registrations, is_default)
		 SELECT w.id, w.name, w.motto, w.industry, w.website, w.logo_url, NULLIF(w.settings->>'locale', ''), COALESCE(w.tax_registrations, '[]'::jsonb), true
		   FROM fonderie_workspaces w
		  WHERE w.id = $1 AND NOT EXISTS (SELECT 1 FROM fonderie_workspace_branches b WHERE b.workspace_id = w.id AND b.is_default)
		 ON CONFLICT DO NOTHING`,
		[workspaceId],
	);
}

/** The default branch's id — created from the workspace's profile when there is none (a workspace older than the backfill, or a race). */
export async function defaultBranchId(tx: IStoreAdapter, workspaceId: string): Promise<string> {
	const [row] = await tx.query<{ id: string }>(`SELECT id FROM fonderie_workspace_branches WHERE workspace_id = $1 AND is_default`, [workspaceId]);
	if (row) return row.id;
	const [made] = await tx.query<{ id: string }>(
		`INSERT INTO fonderie_workspace_branches (workspace_id, name, motto, industry, website, logo_url, locale, tax_registrations, is_default)
		 SELECT id, name, motto, industry, website, logo_url, NULLIF(settings->>'locale', ''), COALESCE(tax_registrations, '[]'::jsonb), true
		   FROM fonderie_workspaces WHERE id = $1
		 ON CONFLICT DO NOTHING
		 RETURNING id`,
		[workspaceId],
	);
	if (made) return made.id;
	const [again] = await tx.query<{ id: string }>(`SELECT id FROM fonderie_workspace_branches WHERE workspace_id = $1 AND is_default`, [workspaceId]);
	if (!again) throw new BranchError(404, 'NOT_FOUND', 'Workspace not found');
	return again.id;
}

/**
 * The branch a contact write targets: the one named, checked to be this
 * workspace's and live; or the default. Call under the workspace lock.
 */
export async function resolveBranch(tx: IStoreAdapter, workspaceId: string, branchId: string | null | undefined): Promise<string> {
	if (!branchId) return defaultBranchId(tx, workspaceId);
	const branch = await getBranch(tx, workspaceId, branchId);
	if (!branch) throw new BranchError(404, 'NOT_FOUND', 'Branch not found');
	if (branch.archivedAt) throw new BranchError(409, 'BRANCH_ARCHIVED', 'Restore this branch before changing it');
	return branch.id;
}

/** Clear the default flag on every other branch, then set it on this one. */
async function moveDefault(tx: IStoreAdapter, workspaceId: string, id: string): Promise<void> {
	await tx.query(`UPDATE fonderie_workspace_branches SET is_default = false, updated_at = now() WHERE workspace_id = $1 AND is_default AND id <> $2`, [workspaceId, id]);
	await tx.query(`UPDATE fonderie_workspace_branches SET is_default = true, updated_at = now() WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function listBranches(workspaceId: string, store: IStoreAdapter): Promise<IWorkspaceBranch[]> {
	return store.query<IWorkspaceBranch>(
		`SELECT ${BRANCH_COLS} FROM fonderie_workspace_branches b WHERE b.workspace_id = $1
		 ORDER BY b.is_default DESC, (b.archived_at IS NOT NULL), b.position, b.created_at, b.id`,
		[workspaceId],
	);
}

export async function findBranch(workspaceId: string, id: string, store: IStoreAdapter): Promise<IWorkspaceBranch | null> {
	return getBranch(store, workspaceId, id);
}

/**
 * The branch a request on `host` belongs to: the live branch whose primary
 * email is on that host — the default one first when several are (two
 * branches of one business on one domain). Not workspace-scoped: a funnel
 * knows the host, not the business.
 */
export async function findBranchByDomain(domain: string, store: IStoreAdapter): Promise<IWorkspaceBranch | null> {
	const [row] = await store.query<IWorkspaceBranch>(
		`SELECT ${BRANCH_COLS} FROM fonderie_workspace_branches b
		 JOIN fonderie_workspace_emails e ON e.branch_id = b.id AND e.is_primary
		 WHERE lower(split_part(e.email, '@', 2)) = $1 AND b.archived_at IS NULL
		 ORDER BY b.is_default DESC, b.position, b.created_at
		 LIMIT 1`,
		[domain.trim().toLowerCase()],
	);
	return row ?? null;
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function createBranch(store: IStoreAdapter, workspaceId: string, input: IBranchInput & { name: string }): Promise<IWorkspaceBranch> {
	return store.transaction(async (tx) => {
		await lockWorkspace(tx, workspaceId);
		const [c] = await tx.query<{ n: string }>(`SELECT count(*) AS n FROM fonderie_workspace_branches WHERE workspace_id = $1`, [workspaceId]);
		const n = Number(c?.n ?? 0);
		if (n >= BRANCH_LIMIT) throw new BranchError(422, 'LIMIT_REACHED', `A workspace holds at most ${BRANCH_LIMIT} branches`);
		const [row] = await tx.query<{ id: string }>(
			`INSERT INTO fonderie_workspace_branches (workspace_id, name, motto, industry, website, logo_url, locale, tax_registrations, position)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING id`,
			[
				workspaceId,
				input.name,
				input.motto ?? null,
				input.industry ?? null,
				input.website ?? null,
				input.logoUrl ?? null,
				input.locale ?? null,
				JSON.stringify(input.taxRegistrations ?? []),
				input.position ?? n,
			],
		);
		if (n === 0 || input.isDefault) await moveDefault(tx, workspaceId, row!.id);
		return (await getBranch(tx, workspaceId, row!.id))!;
	});
}

export async function updateBranch(store: IStoreAdapter, workspaceId: string, id: string, input: IBranchInput): Promise<IWorkspaceBranch> {
	return store.transaction(async (tx) => {
		await lockWorkspace(tx, workspaceId);
		const current = await getBranch(tx, workspaceId, id);
		if (!current) throw new BranchError(404, 'NOT_FOUND', 'Branch not found');
		if (input.isDefault === false && current.isDefault) throw new BranchError(409, 'DEFAULT_REQUIRED', 'Make another branch the default instead');
		if (input.isDefault === true && current.archivedAt) throw new BranchError(409, 'BRANCH_ARCHIVED', 'Restore this branch before making it the default');
		const sets: string[] = ['updated_at = now()'];
		const params: unknown[] = [workspaceId, id];
		const set = (col: string, value: unknown, cast = '') => {
			params.push(value);
			sets.push(`${col} = $${params.length}${cast}`);
		};
		if (input.name !== undefined) set('name', input.name);
		if (input.motto !== undefined) set('motto', input.motto);
		if (input.industry !== undefined) set('industry', input.industry);
		if (input.website !== undefined) set('website', input.website);
		if (input.logoUrl !== undefined) set('logo_url', input.logoUrl);
		if (input.locale !== undefined) set('locale', input.locale);
		if (input.taxRegistrations !== undefined) set('tax_registrations', JSON.stringify(input.taxRegistrations), '::jsonb');
		if (input.position !== undefined) set('position', input.position);
		await tx.query(`UPDATE fonderie_workspace_branches SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2`, params);
		// The workspace's profile reads from whichever branch is the default: nothing else to move.
		if (input.isDefault === true && !current.isDefault) await moveDefault(tx, workspaceId, id);
		return (await getBranch(tx, workspaceId, id))!;
	});
}

export async function archiveBranch(store: IStoreAdapter, workspaceId: string, id: string, byUser: string | null): Promise<IWorkspaceBranch> {
	return store.transaction(async (tx) => {
		await lockWorkspace(tx, workspaceId);
		const current = await getBranch(tx, workspaceId, id);
		if (!current) throw new BranchError(404, 'NOT_FOUND', 'Branch not found');
		if (current.isDefault) throw new BranchError(409, 'DEFAULT_ARCHIVE', 'Make another branch the default first');
		if (!current.archivedAt) {
			await tx.query(
				`UPDATE fonderie_workspace_branches SET archived_at = now(), archived_by = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2`,
				[workspaceId, id, byUser],
			);
		}
		return (await getBranch(tx, workspaceId, id))!;
	});
}

export async function restoreBranch(store: IStoreAdapter, workspaceId: string, id: string): Promise<IWorkspaceBranch> {
	return store.transaction(async (tx) => {
		await lockWorkspace(tx, workspaceId);
		const current = await getBranch(tx, workspaceId, id);
		if (!current) throw new BranchError(404, 'NOT_FOUND', 'Branch not found');
		if (current.archivedAt) {
			await tx.query(
				`UPDATE fonderie_workspace_branches SET archived_at = NULL, archived_by = NULL, updated_at = now() WHERE workspace_id = $1 AND id = $2`,
				[workspaceId, id],
			);
		}
		return (await getBranch(tx, workspaceId, id))!;
	});
}

/** What PUT /workspaces may carry for the default branch; `undefined` = not given. */
export interface IProfileIdentity {
	motto?: string | null | undefined;
	industry?: string | null | undefined;
	website?: string | null | undefined;
	logoUrl?: string | null | undefined;
	taxRegistrations?: ITaxRegistration[] | undefined;
}

/** The other direction: PUT /workspaces { motto | industry | website | logoUrl | taxRegistrations } lands on the default branch. */
export async function profileToDefaultBranch(tx: IStoreAdapter, workspaceId: string, profile: IProfileIdentity): Promise<void> {
	if (Object.values(profile).every((v) => v === undefined)) return;
	await lockWorkspace(tx, workspaceId);
	const id = await defaultBranchId(tx, workspaceId);
	const sets: string[] = ['updated_at = now()'];
	const params: unknown[] = [id];
	const set = (col: string, value: unknown, cast = '') => {
		params.push(value);
		sets.push(`${col} = $${params.length}${cast}`);
	};
	if (profile.motto !== undefined) set('motto', profile.motto);
	if (profile.industry !== undefined) set('industry', profile.industry);
	if (profile.website !== undefined) set('website', profile.website);
	if (profile.logoUrl !== undefined) set('logo_url', profile.logoUrl);
	if (profile.taxRegistrations !== undefined) set('tax_registrations', JSON.stringify(profile.taxRegistrations), '::jsonb');
	await tx.query(`UPDATE fonderie_workspace_branches SET ${sets.join(', ')} WHERE id = $1`, params);
}
