import type { IStoreAdapter } from '@fonderie/store';
import { regions } from '@fonderie/core/region';

import type {
	IWorkspaceAddress,
	IWorkspaceContacts,
	IWorkspaceEmail,
	IWorkspaceLocation,
	IWorkspacePhone,
} from '../types';

// A workspace's emails, phones and locations (migration 010).
//
// fonderie_workspaces.email / phone / address are the MIRROR of the primary
// email, the primary phone and the head office's address. This service keeps
// them in step, in the same transaction as the change, both ways:
//
//   - a write here (add, flag moved, delete…) re-derives the mirror column;
//   - PUT /workspaces with email / phone / address (fromProfile) updates the
//     primary entry or the head office — creating it when there is none.
//
// Every write locks the workspace row first (FOR UPDATE), so two requests at
// once cannot both become "the first entry", both pass a limit, or race a
// flag move.

export const CONTACT_LIMITS = { emails: 10, phones: 10, locations: 50 } as const;

export const E164 = /^\+[1-9][0-9]{6,14}$/;

/** A refusal the controller turns into a response. */
export class ContactError extends Error {
	constructor(
		readonly status: 404 | 409 | 422,
		readonly reason: string,
		message: string,
	) {
		super(message);
	}
}

const notFound = (what: string) => new ContactError(404, 'NOT_FOUND', `${what} not found`);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_COLS = `id, workspace_id AS "workspaceId", email, label, is_primary AS "isPrimary", position,
	created_at AS "createdAt", updated_at AS "updatedAt"`;
const PHONE_COLS = `id, workspace_id AS "workspaceId", phone, extension, label, is_primary AS "isPrimary", position,
	created_at AS "createdAt", updated_at AS "updatedAt"`;
const LOCATION_COLS = `id, workspace_id AS "workspaceId", name, address, country, tax_region AS "taxRegion",
	latitude, longitude, phone, email, is_head_office AS "isHeadOffice", position,
	archived_at AS "archivedAt", archived_by AS "archivedBy", created_at AS "createdAt", updated_at AS "updatedAt"`;

/** 'CA' + 'QC' → 'CA-QC' when the country has subdivisions and this is one of them; else null. */
export function taxRegionOf(address: IWorkspaceAddress | null | undefined): string | null {
	const country = (address?.country ?? '').trim().toUpperCase();
	const state = (address?.state ?? '').trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z0-9]{1,3}$/.test(state)) return null;
	const subs = regions.get(country)?.subdivisions;
	if (!subs || !subs[state]) return null;
	return `${country}-${state}`;
}

const isEmpty = (a: IWorkspaceAddress | null | undefined) =>
	!a || Object.values(a).every((v) => v === undefined || v === null || String(v).trim() === '');

async function lock(tx: IStoreAdapter, workspaceId: string): Promise<void> {
	await tx.query(`SELECT 1 FROM fonderie_workspaces WHERE id = $1 FOR UPDATE`, [workspaceId]);
}

async function count(tx: IStoreAdapter, table: string, workspaceId: string): Promise<number> {
	const [row] = await tx.query<{ n: string }>(`SELECT count(*) AS n FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
	return Number(row?.n ?? 0);
}

// ── Mirrors ──────────────────────────────────────────────────────────────────

async function mirrorEmail(tx: IStoreAdapter, workspaceId: string): Promise<void> {
	await tx.query(
		`UPDATE fonderie_workspaces
		 SET email = (SELECT email FROM fonderie_workspace_emails WHERE workspace_id = $1 AND is_primary), updated_at = now()
		 WHERE id = $1`,
		[workspaceId],
	);
}

async function mirrorPhone(tx: IStoreAdapter, workspaceId: string): Promise<void> {
	await tx.query(
		`UPDATE fonderie_workspaces
		 SET phone = (SELECT phone FROM fonderie_workspace_phones WHERE workspace_id = $1 AND is_primary), updated_at = now()
		 WHERE id = $1`,
		[workspaceId],
	);
}

async function mirrorAddress(tx: IStoreAdapter, workspaceId: string): Promise<void> {
	await tx.query(
		`UPDATE fonderie_workspaces
		 SET address = COALESCE((SELECT address FROM fonderie_workspace_locations WHERE workspace_id = $1 AND is_head_office), '{}'::jsonb),
		     updated_at = now()
		 WHERE id = $1`,
		[workspaceId],
	);
}

/** Clear the flag on every other row, then set it on this one (the partial unique index allows one). */
async function moveFlag(tx: IStoreAdapter, table: string, flag: string, workspaceId: string, id: string): Promise<void> {
	await tx.query(`UPDATE ${table} SET ${flag} = false, updated_at = now() WHERE workspace_id = $1 AND ${flag} AND id <> $2`, [workspaceId, id]);
	await tx.query(`UPDATE ${table} SET ${flag} = true, updated_at = now() WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
}

/** After the primary left: the next one (by position, then age) becomes primary. */
async function promoteNext(tx: IStoreAdapter, table: 'fonderie_workspace_emails' | 'fonderie_workspace_phones', workspaceId: string): Promise<void> {
	await tx.query(
		`UPDATE ${table} SET is_primary = true, updated_at = now()
		 WHERE id = (SELECT id FROM ${table} WHERE workspace_id = $1 ORDER BY position, created_at, id LIMIT 1)
		   AND NOT EXISTS (SELECT 1 FROM ${table} WHERE workspace_id = $1 AND is_primary)`,
		[workspaceId],
	);
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function listContacts(workspaceId: string, store: IStoreAdapter): Promise<IWorkspaceContacts> {
	const [emails, phones, locations] = await Promise.all([
		store.query<IWorkspaceEmail>(
			`SELECT ${EMAIL_COLS} FROM fonderie_workspace_emails WHERE workspace_id = $1 ORDER BY is_primary DESC, position, created_at, id`,
			[workspaceId],
		),
		store.query<IWorkspacePhone>(
			`SELECT ${PHONE_COLS} FROM fonderie_workspace_phones WHERE workspace_id = $1 ORDER BY is_primary DESC, position, created_at, id`,
			[workspaceId],
		),
		store.query<IWorkspaceLocation>(
			`SELECT ${LOCATION_COLS} FROM fonderie_workspace_locations WHERE workspace_id = $1
			 ORDER BY is_head_office DESC, (archived_at IS NOT NULL), position, created_at, id`,
			[workspaceId],
		),
	]);
	return { emails, phones, locations };
}

// ── Emails ───────────────────────────────────────────────────────────────────

export async function addEmail(
	store: IStoreAdapter,
	workspaceId: string,
	input: { email: string; label?: string | null; isPrimary?: boolean },
): Promise<IWorkspaceEmail> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const n = await count(tx, 'fonderie_workspace_emails', workspaceId);
		if (n >= CONTACT_LIMITS.emails) throw new ContactError(422, 'LIMIT_REACHED', `A workspace holds at most ${CONTACT_LIMITS.emails} emails`);
		const email = input.email.trim().toLowerCase();
		const [dup] = await tx.query(`SELECT 1 FROM fonderie_workspace_emails WHERE workspace_id = $1 AND email = $2`, [workspaceId, email]);
		if (dup) throw new ContactError(409, 'DUPLICATE', 'This email is already on the workspace');
		const [row] = await tx.query<IWorkspaceEmail>(
			`INSERT INTO fonderie_workspace_emails (workspace_id, email, label, position)
			 VALUES ($1, $2, $3, $4) RETURNING id`,
			[workspaceId, email, input.label ?? null, n],
		);
		if (n === 0 || input.isPrimary) await moveFlag(tx, 'fonderie_workspace_emails', 'is_primary', workspaceId, row!.id);
		await mirrorEmail(tx, workspaceId);
		return (await getOne<IWorkspaceEmail>(tx, 'fonderie_workspace_emails', EMAIL_COLS, workspaceId, row!.id))!;
	});
}

export async function updateEmail(
	store: IStoreAdapter,
	workspaceId: string,
	id: string,
	input: { label?: string | null; isPrimary?: boolean; position?: number },
): Promise<IWorkspaceEmail> {
	return updateListEntry(store, 'fonderie_workspace_emails', EMAIL_COLS, 'Email', workspaceId, id, input, mirrorEmail);
}

export async function removeEmail(store: IStoreAdapter, workspaceId: string, id: string): Promise<void> {
	return removeListEntry(store, 'fonderie_workspace_emails', 'Email', workspaceId, id, mirrorEmail);
}

// ── Phones ───────────────────────────────────────────────────────────────────

export async function addPhone(
	store: IStoreAdapter,
	workspaceId: string,
	input: { phone: string; extension?: string | null; label?: string | null; isPrimary?: boolean },
): Promise<IWorkspacePhone> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const n = await count(tx, 'fonderie_workspace_phones', workspaceId);
		if (n >= CONTACT_LIMITS.phones) throw new ContactError(422, 'LIMIT_REACHED', `A workspace holds at most ${CONTACT_LIMITS.phones} phones`);
		const extension = input.extension || null;
		const [dup] = await tx.query(
			`SELECT 1 FROM fonderie_workspace_phones WHERE workspace_id = $1 AND phone = $2 AND extension IS NOT DISTINCT FROM $3`,
			[workspaceId, input.phone, extension],
		);
		if (dup) throw new ContactError(409, 'DUPLICATE', 'This phone number is already on the workspace');
		const [row] = await tx.query<IWorkspacePhone>(
			`INSERT INTO fonderie_workspace_phones (workspace_id, phone, extension, label, position)
			 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			[workspaceId, input.phone, extension, input.label ?? null, n],
		);
		if (n === 0 || input.isPrimary) await moveFlag(tx, 'fonderie_workspace_phones', 'is_primary', workspaceId, row!.id);
		await mirrorPhone(tx, workspaceId);
		return (await getOne<IWorkspacePhone>(tx, 'fonderie_workspace_phones', PHONE_COLS, workspaceId, row!.id))!;
	});
}

export async function updatePhone(
	store: IStoreAdapter,
	workspaceId: string,
	id: string,
	input: { extension?: string | null; label?: string | null; isPrimary?: boolean; position?: number },
): Promise<IWorkspacePhone> {
	return updateListEntry(store, 'fonderie_workspace_phones', PHONE_COLS, 'Phone', workspaceId, id, input, mirrorPhone);
}

export async function removePhone(store: IStoreAdapter, workspaceId: string, id: string): Promise<void> {
	return removeListEntry(store, 'fonderie_workspace_phones', 'Phone', workspaceId, id, mirrorPhone);
}

// ── Shared list-entry rules (emails, phones) ─────────────────────────────────

async function getOne<T>(tx: IStoreAdapter, table: string, cols: string, workspaceId: string, id: string): Promise<T | null> {
	if (!UUID.test(id)) return null;
	const [row] = await tx.query<T>(`SELECT ${cols} FROM ${table} WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
	return row ?? null;
}

async function updateListEntry<T extends { isPrimary: boolean }>(
	store: IStoreAdapter,
	table: 'fonderie_workspace_emails' | 'fonderie_workspace_phones',
	cols: string,
	what: string,
	workspaceId: string,
	id: string,
	input: { label?: string | null; isPrimary?: boolean; position?: number; extension?: string | null },
	mirror: (tx: IStoreAdapter, workspaceId: string) => Promise<void>,
): Promise<T> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const current = await getOne<T>(tx, table, cols, workspaceId, id);
		if (!current) throw notFound(what);
		if (input.isPrimary === false && current.isPrimary) {
			throw new ContactError(409, 'PRIMARY_REQUIRED', `Make another ${what.toLowerCase()} primary instead`);
		}
		const sets: string[] = ['updated_at = now()'];
		const params: unknown[] = [workspaceId, id];
		if (input.label !== undefined) {
			params.push(input.label);
			sets.push(`label = $${params.length}`);
		}
		if (input.position !== undefined) {
			params.push(input.position);
			sets.push(`position = $${params.length}`);
		}
		if (input.extension !== undefined && table === 'fonderie_workspace_phones') {
			const phone = current as unknown as IWorkspacePhone;
			const extension = input.extension || null;
			const [dup] = await tx.query(
				`SELECT 1 FROM fonderie_workspace_phones WHERE workspace_id = $1 AND phone = $2 AND extension IS NOT DISTINCT FROM $3 AND id <> $4`,
				[workspaceId, phone.phone, extension, id],
			);
			if (dup) throw new ContactError(409, 'DUPLICATE', 'This phone number is already on the workspace');
			params.push(extension);
			sets.push(`extension = $${params.length}`);
		}
		await tx.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2`, params);
		if (input.isPrimary === true && !current.isPrimary) {
			await moveFlag(tx, table, 'is_primary', workspaceId, id);
			await mirror(tx, workspaceId);
		}
		return (await getOne<T>(tx, table, cols, workspaceId, id))!;
	});
}

async function removeListEntry(
	store: IStoreAdapter,
	table: 'fonderie_workspace_emails' | 'fonderie_workspace_phones',
	what: string,
	workspaceId: string,
	id: string,
	mirror: (tx: IStoreAdapter, workspaceId: string) => Promise<void>,
): Promise<void> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const current = await getOne<{ isPrimary: boolean }>(tx, table, 'is_primary AS "isPrimary"', workspaceId, id);
		if (!current) throw notFound(what);
		if (current.isPrimary && (await count(tx, table, workspaceId)) > 1) {
			throw new ContactError(409, 'PRIMARY_REQUIRED', `Make another ${what.toLowerCase()} primary before removing this one`);
		}
		await tx.query(`DELETE FROM ${table} WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
		// The last one gone: the mirror column is cleared.
		if (current.isPrimary) await mirror(tx, workspaceId);
	});
}

// ── Locations ────────────────────────────────────────────────────────────────

export interface ILocationInput {
	name?: string;
	address?: IWorkspaceAddress;
	taxRegion?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	phone?: string | null;
	email?: string | null;
	isHeadOffice?: boolean;
	position?: number;
}

const getLocation = (tx: IStoreAdapter, workspaceId: string, id: string) =>
	getOne<IWorkspaceLocation>(tx, 'fonderie_workspace_locations', LOCATION_COLS, workspaceId, id);

export async function createLocation(store: IStoreAdapter, workspaceId: string, input: ILocationInput & { name: string; address: IWorkspaceAddress }): Promise<IWorkspaceLocation> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const n = await count(tx, 'fonderie_workspace_locations', workspaceId);
		if (n >= CONTACT_LIMITS.locations) throw new ContactError(422, 'LIMIT_REACHED', `A workspace holds at most ${CONTACT_LIMITS.locations} locations`);
		const [head] = await tx.query(`SELECT 1 FROM fonderie_workspace_locations WHERE workspace_id = $1 AND is_head_office`, [workspaceId]);
		const taxRegion = input.taxRegion !== undefined ? input.taxRegion : taxRegionOf(input.address);
		const [row] = await tx.query<{ id: string }>(
			`INSERT INTO fonderie_workspace_locations
			   (workspace_id, name, address, tax_region, latitude, longitude, phone, email, position)
			 VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9) RETURNING id`,
			[
				workspaceId,
				input.name,
				JSON.stringify(input.address ?? {}),
				taxRegion,
				input.latitude ?? null,
				input.longitude ?? null,
				input.phone ?? null,
				input.email?.toLowerCase() ?? null,
				input.position ?? n,
			],
		);
		if (!head || input.isHeadOffice) {
			await moveFlag(tx, 'fonderie_workspace_locations', 'is_head_office', workspaceId, row!.id);
			await mirrorAddress(tx, workspaceId);
		}
		return (await getLocation(tx, workspaceId, row!.id))!;
	});
}

export async function updateLocation(store: IStoreAdapter, workspaceId: string, id: string, input: ILocationInput): Promise<IWorkspaceLocation> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const current = await getLocation(tx, workspaceId, id);
		if (!current) throw notFound('Location');
		if (input.isHeadOffice === false && current.isHeadOffice) {
			throw new ContactError(409, 'HEAD_OFFICE_REQUIRED', 'Make another location the head office instead');
		}
		if (input.isHeadOffice === true && current.archivedAt) {
			throw new ContactError(409, 'LOCATION_ARCHIVED', 'Restore this location before making it the head office');
		}
		const sets: string[] = ['updated_at = now()'];
		const params: unknown[] = [workspaceId, id];
		const set = (col: string, value: unknown, cast = '') => {
			params.push(value);
			sets.push(`${col} = $${params.length}${cast}`);
		};
		if (input.name !== undefined) set('name', input.name);
		if (input.address !== undefined) set('address', JSON.stringify(input.address ?? {}), '::jsonb');
		// A new address re-derives the tax region unless one is given.
		if (input.taxRegion !== undefined) set('tax_region', input.taxRegion);
		else if (input.address !== undefined) set('tax_region', taxRegionOf(input.address));
		if (input.latitude !== undefined) set('latitude', input.latitude);
		if (input.longitude !== undefined) set('longitude', input.longitude);
		if (input.phone !== undefined) set('phone', input.phone);
		if (input.email !== undefined) set('email', input.email?.toLowerCase() ?? null);
		if (input.position !== undefined) set('position', input.position);
		await tx.query(`UPDATE fonderie_workspace_locations SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2`, params);
		if (input.isHeadOffice === true && !current.isHeadOffice) {
			await moveFlag(tx, 'fonderie_workspace_locations', 'is_head_office', workspaceId, id);
			await mirrorAddress(tx, workspaceId);
		} else if (current.isHeadOffice && input.address !== undefined) {
			await mirrorAddress(tx, workspaceId);
		}
		return (await getLocation(tx, workspaceId, id))!;
	});
}

export async function archiveLocation(store: IStoreAdapter, workspaceId: string, id: string, byUser: string | null): Promise<IWorkspaceLocation> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const current = await getLocation(tx, workspaceId, id);
		if (!current) throw notFound('Location');
		if (current.isHeadOffice) throw new ContactError(409, 'HEAD_OFFICE_ARCHIVE', 'Move the head office to another location first');
		if (!current.archivedAt) {
			await tx.query(
				`UPDATE fonderie_workspace_locations SET archived_at = now(), archived_by = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2`,
				[workspaceId, id, byUser],
			);
		}
		return (await getLocation(tx, workspaceId, id))!;
	});
}

export async function restoreLocation(store: IStoreAdapter, workspaceId: string, id: string): Promise<IWorkspaceLocation> {
	return store.transaction(async (tx) => {
		await lock(tx, workspaceId);
		const current = await getLocation(tx, workspaceId, id);
		if (!current) throw notFound('Location');
		if (current.archivedAt) {
			await tx.query(
				`UPDATE fonderie_workspace_locations SET archived_at = NULL, archived_by = NULL, updated_at = now() WHERE workspace_id = $1 AND id = $2`,
				[workspaceId, id],
			);
		}
		return (await getLocation(tx, workspaceId, id))!;
	});
}

// ── The other direction: PUT /workspaces { email | phone | address } ─────────

/**
 * Called in the same transaction as the profile update, after it. The profile's
 * email / phone / address become the primary email / primary phone / head
 * office — created when there is none. A phone that is not E.164 ('514 555
 * 0100') cannot be a phone entry: it stays on the workspace as typed, and the
 * phone list is left alone.
 */
export async function fromProfile(
	tx: IStoreAdapter,
	workspaceId: string,
	profile: { email?: string | null | undefined; phone?: string | null | undefined; address?: IWorkspaceAddress | null | undefined },
): Promise<void> {
	if (profile.email === undefined && profile.phone === undefined && profile.address === undefined) return;
	await lock(tx, workspaceId);

	if (profile.email !== undefined) {
		const email = profile.email?.trim().toLowerCase() || null;
		await setPrimaryValue(tx, 'fonderie_workspace_emails', 'email', workspaceId, email, CONTACT_LIMITS.emails);
		await mirrorEmail(tx, workspaceId);
	}

	if (profile.phone !== undefined) {
		const phone = profile.phone?.replace(/[\s().-]/g, '') || null;
		if (phone === null || E164.test(phone)) {
			await setPrimaryValue(tx, 'fonderie_workspace_phones', 'phone', workspaceId, phone, CONTACT_LIMITS.phones);
			await mirrorPhone(tx, workspaceId);
		}
	}

	if (profile.address !== undefined) {
		const address = isEmpty(profile.address) ? {} : profile.address!;
		const [head] = await tx.query<{ id: string }>(
			`SELECT id FROM fonderie_workspace_locations WHERE workspace_id = $1 AND is_head_office`,
			[workspaceId],
		);
		if (head) {
			await tx.query(
				`UPDATE fonderie_workspace_locations SET address = $3::jsonb, tax_region = $4, updated_at = now() WHERE workspace_id = $1 AND id = $2`,
				[workspaceId, head.id, JSON.stringify(address), taxRegionOf(address)],
			);
		} else if (!isEmpty(address) && (await count(tx, 'fonderie_workspace_locations', workspaceId)) < CONTACT_LIMITS.locations) {
			await tx.query(
				`INSERT INTO fonderie_workspace_locations (workspace_id, name, address, tax_region, is_head_office)
				 VALUES ($1, 'Head office', $2::jsonb, $3, true)`,
				[workspaceId, JSON.stringify(address), taxRegionOf(address)],
			);
		}
		await mirrorAddress(tx, workspaceId);
	}
}

/**
 * The primary entry becomes `value`: an existing entry with that value takes
 * the flag; otherwise the primary's value is replaced, or a primary is created.
 * null removes the primary (the next one, if any, takes its place).
 */
async function setPrimaryValue(
	tx: IStoreAdapter,
	table: 'fonderie_workspace_emails' | 'fonderie_workspace_phones',
	col: 'email' | 'phone',
	workspaceId: string,
	value: string | null,
	limit: number,
): Promise<void> {
	const noExt = table === 'fonderie_workspace_phones' ? ' AND extension IS NULL' : '';
	const [primary] = await tx.query<{ id: string; value: string }>(
		`SELECT id, ${col} AS value FROM ${table} WHERE workspace_id = $1 AND is_primary`,
		[workspaceId],
	);
	if (value === null) {
		if (primary) {
			await tx.query(`DELETE FROM ${table} WHERE workspace_id = $1 AND id = $2`, [workspaceId, primary.id]);
			await promoteNext(tx, table, workspaceId);
		}
		return;
	}
	if (primary?.value === value) return;
	const [existing] = await tx.query<{ id: string }>(
		`SELECT id FROM ${table} WHERE workspace_id = $1 AND ${col} = $2${noExt}`,
		[workspaceId, value],
	);
	if (existing) {
		await moveFlag(tx, table, 'is_primary', workspaceId, existing.id);
		return;
	}
	if (primary) {
		await tx.query(`UPDATE ${table} SET ${col} = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2`, [workspaceId, primary.id, value]);
		return;
	}
	const n = await count(tx, table, workspaceId);
	if (n >= limit) return; // full: the profile column still holds it (mirror re-derives below)
	const [row] = await tx.query<{ id: string }>(
		`INSERT INTO ${table} (workspace_id, ${col}, position) VALUES ($1, $2, $3) RETURNING id`,
		[workspaceId, value, n],
	);
	await moveFlag(tx, table, 'is_primary', workspaceId, row!.id);
}
