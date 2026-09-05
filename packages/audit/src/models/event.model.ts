import type { IStoreAdapter } from '@fonderie/store';

import type { IAuditEvent, IAuditQuery } from '../types';
import { decodeCursor } from '../dtos/audit';

const MAX_LIMIT = 200;

export type IAuditEventRow = IAuditEvent & {
	// created_at::text — full microsecond precision for the keyset cursor
	// (node-pg parses timestamptz into a millisecond Date, which would make
	// the cursor skip same-millisecond rows between pages).
	createdAtRaw: string;
};

export interface IAuditEventPage {
	events: IAuditEventRow[];
	hasMore: boolean;
}

export class AuditEventModel {
	constructor(private readonly store: IStoreAdapter) {}

	// `query.limit` is the CLIENT-facing page size. The +1 over-fetch that
	// detects a next page happens inside this method — keeping it here means
	// no outer clamp can shave it off (which previously made nextCursor
	// unreachable at the max page size).
	async list(query: IAuditQuery): Promise<IAuditEventPage> {
		const limit = Math.min(query.limit ?? 50, MAX_LIMIT);
		const params: unknown[] = [query.workspaceId];
		const where: string[] = [`payload->>'workspaceId' = $1`];

		if (query.type) {
			params.push(query.type);
			where.push(`type = $${params.length}`);
		}

		if (query.actorId) {
			params.push(query.actorId);
			where.push(`payload->>'userId' = $${params.length}`);
		}

		if (query.from) {
			params.push(query.from);
			where.push(`created_at >= $${params.length}`);
		}

		if (query.to) {
			params.push(query.to);
			where.push(`created_at <= $${params.length}`);
		}

		if (query.cursor) {
			const decoded = decodeCursor(query.cursor);
			if (decoded) {
				params.push(decoded.createdAt, decoded.id);
				where.push(
					`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
				);
			}
		}

		params.push(limit + 1);

		const rows = await this.store.query<IAuditEventRow>(
			`SELECT id, type, payload, meta, created_at as "createdAt",
			        created_at::text as "createdAtRaw"
			 FROM   fonderie_events
			 WHERE  ${where.join(' AND ')}
			 ORDER  BY created_at DESC, id DESC
			 LIMIT  $${params.length}`,
			params,
		);

		return { events: rows.slice(0, limit), hasMore: rows.length > limit };
	}
}
