import { encodeKeysetCursor, decodeKeysetCursor } from '@fonderie/core';

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
// The audit event log's keyset cursor is the shared @fonderie/core primitive.
// decodeKeysetCursor RANGE-checks the timestamp, so a crafted in-shape-but-out-
// of-range cursor now decodes to null — the model drops the keyset predicate and
// returns the first (newest) page — instead of reaching the ::timestamptz cast
// as a 500, the bug the old lax local regex had.
export function encodeCursor(createdAt: Date | string, id: string): string {
	const ts = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
	return encodeKeysetCursor(ts, id);
}

export const decodeCursor = decodeKeysetCursor;
