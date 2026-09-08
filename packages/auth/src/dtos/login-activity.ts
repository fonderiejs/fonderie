import { encodeKeysetCursor, decodeKeysetCursor } from '@fonderie/core';

import type { ILoginEventRow, ILoginEventPage } from '../models/login-event.model';

// ── Login history ────────────────────────────────────────────────

export interface ILoginEventDTO {
	id: string;
	method: string;
	outcome: string;
	failureReason: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
}

export interface ILoginHistoryPageDTO {
	events: ILoginEventDTO[];
	nextCursor: string | null;
}

function toLoginEventDTO(row: ILoginEventRow): ILoginEventDTO {
	return {
		id: row.id,
		method: row.method,
		outcome: row.outcome,
		failureReason: row.failureReason,
		ipAddress: row.ipAddress,
		userAgent: row.userAgent,
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
	};
}

export function toLoginHistoryPageDTO(page: ILoginEventPage): ILoginHistoryPageDTO {
	const last = page.events[page.events.length - 1];
	// Cursor carries created_at at full microsecond precision (createdAtRaw) so
	// same-microsecond rows can't be skipped between pages.
	const nextCursor =
		page.hasMore && last ? encodeKeysetCursor(last.createdAtRaw ?? last.createdAt.toISOString(), last.id) : null;
	return { events: page.events.map(toLoginEventDTO), nextCursor };
}

// Shared cursor decode (range-checked in core; a crafted cursor → null → the
// caller's 422, never a Postgres cast 500).
export const decodeLoginCursor = decodeKeysetCursor;

// ── Active sessions ──────────────────────────────────────────────

export interface ISessionDTO {
	id: string;
	current: boolean;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
	expiresAt: string;
}

export function toSessionDTO(
	row: {
		id: string;
		sid: string | null;
		userAgent: string | null;
		ipAddress: string | null;
		createdAt: Date;
		expiresAt: Date;
	},
	currentSid: string | null,
): ISessionDTO {
	return {
		id: row.id,
		current: currentSid !== null && row.sid === currentSid,
		ipAddress: row.ipAddress,
		userAgent: row.userAgent,
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
		expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
	};
}
