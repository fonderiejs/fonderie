import { encodeKeysetCursor, decodeKeysetCursor } from '@fonderie/core';

import type { ILoginEventRow, ILoginEventPage } from '../models/login-event.model';
import { type IRequestLocation, sanitizeLocation } from '../services/request-location';

// ── Login history ────────────────────────────────────────────────

export interface ILoginEventDTO {
	id: string;
	method: string;
	outcome: string;
	failureReason: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	/** Where the attempt came from — present only when the app configures
	 * `location`. Country is reliable; region/city are approximate. */
	location: IRequestLocation | null;
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
		// Re-sanitized on read: the column is JSONB and could have been written
		// by anything with database access.
		location: sanitizeLocation(row.location),
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
	/** Where the session was opened from, when `location` is configured. */
	location: IRequestLocation | null;
	createdAt: string;
	expiresAt: string;
	/** The platform declared at sign-in (mobile | desktop | web), or null. */
	clientKind: string | null;
}

export function toSessionDTO(
	row: {
		id: string;
		sid: string | null;
		userAgent: string | null;
		ipAddress: string | null;
		location?: unknown;
		clientKind?: string | null;
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
		location: sanitizeLocation(row.location),
		clientKind: row.clientKind ?? null,
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
		expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
	};
}
