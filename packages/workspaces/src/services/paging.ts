// Optional keyset paging for the members and invitations lists. Absent (no
// `limit`, no `cursor`) the list is returned whole, as it always was; present,
// one page at a time in a STABLE order with an opaque `nextCursor`.
//
// The cursor carries the sort key's created_at as Postgres text — full
// microsecond precision. node-pg parses timestamptz into a millisecond Date,
// which would skip rows created in the same millisecond between pages.

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface IPageRequest {
	limit: number;
	after: { at: string; id: string } | null;
}

export class PageRequestError extends Error {}

// timestamptz::text, e.g. '2026-01-01 00:00:00.123456+00' (or with a 'T').
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(at: string, id: string): string {
	return Buffer.from(`${at}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { at: string; id: string } | null {
	let raw: string;
	try {
		raw = Buffer.from(cursor, 'base64url').toString('utf8');
	} catch {
		return null;
	}
	const bar = raw.lastIndexOf('|');
	if (bar < 1) return null;
	const at = raw.slice(0, bar);
	const id = raw.slice(bar + 1);
	if (!UUID.test(id) || !PG_TIMESTAMP.test(at)) return null;
	return { at, id };
}

/**
 * The page a request asks for, or null when it asks for none (the whole list).
 * Throws PageRequestError on a malformed limit or cursor.
 */
export function pageRequestOf(url: string): IPageRequest | null {
	const params = new URL(url).searchParams;
	const rawLimit = params.get('limit');
	const cursor = params.get('cursor');
	if (rawLimit === null && cursor === null) return null;
	let limit = DEFAULT_PAGE_SIZE;
	if (rawLimit !== null) {
		const n = Number(rawLimit);
		if (!Number.isInteger(n) || n < 1) throw new PageRequestError('limit must be a positive integer');
		limit = Math.min(n, MAX_PAGE_SIZE);
	}
	let after: IPageRequest['after'] = null;
	if (cursor !== null && cursor !== '') {
		after = decodeCursor(cursor);
		if (!after) throw new PageRequestError('cursor is not valid');
	}
	return { limit, after };
}
