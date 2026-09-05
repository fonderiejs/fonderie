import type { IAuditEvent } from '../types';

export interface IAuditEventDTO {
	id: string;
	type: string;
	actorId: string | null;
	requestId: string | null;
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface IAuditPageDTO {
	events: IAuditEventDTO[];
	nextCursor: string | null;
}

export function toAuditEventDTO(e: IAuditEvent): IAuditEventDTO {
	return {
		id: e.id,
		type: e.type,
		actorId: (e.payload['userId'] as string | undefined) ?? null,
		requestId: (e.meta['requestId'] as string | undefined) ?? null,
		payload: e.payload,
		createdAt: e.createdAt.toISOString(),
	};
}

// Cursors accept ISO timestamps and Postgres' own text format (microsecond
// precision, e.g. '2026-09-05 00:38:31.123456+00') — the keyset carries the
// latter, because round-tripping through a millisecond JS Date truncates
// sub-millisecond digits and silently skips same-millisecond events (rows
// created in one transaction all share now() exactly) between pages.
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const CURSOR_ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function encodeCursor(createdAt: Date | string, id: string): string {
	const ts = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
	return Buffer.from(`${ts},${id}`).toString('base64');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
	if (cursor.length > 256) return null;
	try {
		const raw = Buffer.from(cursor, 'base64').toString();
		const commaIdx = raw.indexOf(',');
		if (commaIdx === -1) return null;
		const createdAt = raw.slice(0, commaIdx);
		const id = raw.slice(commaIdx + 1);
		// Both halves feed ::timestamptz / ::uuid casts — validate here so a
		// crafted cursor yields an empty page, not a Postgres cast error.
		if (!CURSOR_TS_RE.test(createdAt) || !CURSOR_ID_RE.test(id)) return null;
		return { createdAt, id };
	} catch {
		return null;
	}
}
