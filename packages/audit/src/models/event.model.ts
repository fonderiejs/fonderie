import type { IStoreAdapter } from '@fonderie/store';

import type { IAuditEvent, IAuditQuery } from '../types';
import { decodeCursor } from '../dtos/audit';

const MAX_LIMIT = 200;

export class AuditEventModel {
	constructor(private readonly store: IStoreAdapter) {}

	async list(query: IAuditQuery): Promise<IAuditEvent[]> {
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

		params.push(limit);

		return this.store.query<IAuditEvent>(
			`SELECT id, type, payload, meta, created_at as "createdAt"
			 FROM   fonderie_events
			 WHERE  ${where.join(' AND ')}
			 ORDER  BY created_at DESC, id DESC
			 LIMIT  $${params.length}`,
			params,
		);
	}
}
