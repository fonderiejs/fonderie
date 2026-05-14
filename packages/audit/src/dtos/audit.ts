import type { IAuditEvent } from '../types';

export interface IAuditEventDTO {
	id:        string;
	type:      string;
	actorId:   string | null;
	requestId: string | null;
	payload:   Record<string, unknown>;
	createdAt: string;
}

export interface IAuditPageDTO {
	events:     IAuditEventDTO[];
	nextCursor: string | null;
}

export function toAuditEventDTO(e: IAuditEvent): IAuditEventDTO {
	return {
		id:        e.id,
		type:      e.type,
		actorId:   (e.payload['userId'] as string | undefined) ?? null,
		requestId: (e.meta['requestId'] as string | undefined) ?? null,
		payload:   e.payload,
		createdAt: e.createdAt.toISOString(),
	};
}

export function encodeCursor(createdAt: Date, id: string): string {
	return Buffer.from(`${createdAt.toISOString()},${id}`).toString('base64');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
	try {
		const raw      = Buffer.from(cursor, 'base64').toString();
		const commaIdx = raw.indexOf(',');
		if (commaIdx === -1) return null;
		const createdAt = raw.slice(0, commaIdx);
		const id        = raw.slice(commaIdx + 1);
		if (!id || isNaN(Date.parse(createdAt))) return null;
		return { createdAt, id };
	} catch {
		return null;
	}
}
