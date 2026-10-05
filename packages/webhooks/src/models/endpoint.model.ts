import type { IStoreAdapter } from '@fonderie/store';

import type { IBinnedEndpoint, IWebhookEndpoint } from '../types';

/** How long a deleted endpoint stays restorable. */
export const BIN_RETENTION_DAYS = 30;

const COLS = `id, workspace_id as "workspaceId", url, secret, events,
              enabled, created_at as "createdAt"`;

export class EndpointModel {
	constructor(private readonly store: IStoreAdapter) {}

	async create(data: {
		workspaceId: string;
		url: string;
		secret: string;
		events: string[];
	}): Promise<IWebhookEndpoint> {
		const [row] = await this.store.query<IWebhookEndpoint>(
			`INSERT INTO fonderie_webhook_endpoints (workspace_id, url, secret, events)
			 VALUES ($1, $2, $3, $4)
			 RETURNING ${COLS}`,
			[data.workspaceId, data.url, data.secret, data.events],
		);
		return row!;
	}

	list(workspaceId: string): Promise<IWebhookEndpoint[]> {
		return this.store.query<IWebhookEndpoint>(
			`SELECT ${COLS} FROM fonderie_webhook_endpoints
			 WHERE workspace_id = $1
			 ORDER BY created_at DESC`,
			[workspaceId],
		);
	}

	async findById(id: string, workspaceId: string): Promise<IWebhookEndpoint | null> {
		const [row] = await this.store.query<IWebhookEndpoint>(
			`SELECT ${COLS} FROM fonderie_webhook_endpoints
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
		return row ?? null;
	}

	async update(
		id: string,
		workspaceId: string,
		data: { url?: string; events?: string[]; enabled?: boolean },
	): Promise<IWebhookEndpoint | null> {
		const sets: string[] = [];
		const params: unknown[] = [id, workspaceId];

		if (data.url !== undefined) {
			params.push(data.url);
			sets.push(`url = $${params.length}`);
		}
		if (data.events !== undefined) {
			params.push(data.events);
			sets.push(`events = $${params.length}`);
		}
		if (data.enabled !== undefined) {
			params.push(data.enabled);
			sets.push(`enabled = $${params.length}`);
		}

		if (sets.length === 0) return this.findById(id, workspaceId);

		const [row] = await this.store.query<IWebhookEndpoint>(
			`UPDATE fonderie_webhook_endpoints SET ${sets.join(', ')}
			 WHERE id = $1 AND workspace_id = $2
			 RETURNING ${COLS}`,
			params,
		);
		return row ?? null;
	}

	// Into the undo bin, in ONE statement: the row goes and its snapshot lands,
	// or neither. Restorable for BIN_RETENTION_DAYS.
	async delete(id: string, workspaceId: string, deletedBy?: string | null): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`WITH gone AS (
			   DELETE FROM fonderie_webhook_endpoints WHERE id = $1 AND workspace_id = $2 RETURNING *
			 )
			 INSERT INTO fonderie_webhook_endpoint_bin (id, workspace_id, snapshot, deleted_by)
			 SELECT gone.id, gone.workspace_id, to_jsonb(gone), $3 FROM gone
			 ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, deleted_by = EXCLUDED.deleted_by, deleted_at = now()
			 RETURNING id`,
			[id, workspaceId, deletedBy ?? null],
		);
		return rows.length > 0;
	}

	// What the bin holds for this workspace, newest first — never the secret.
	listBin(workspaceId: string, retentionDays = BIN_RETENTION_DAYS): Promise<IBinnedEndpoint[]> {
		return this.store.query<IBinnedEndpoint>(
			`SELECT id, snapshot->>'url' AS url,
			        ARRAY(SELECT jsonb_array_elements_text(snapshot->'events')) AS events,
			        deleted_by AS "deletedBy", deleted_at AS "deletedAt",
			        deleted_at + make_interval(days => $2) AS "purgeAt"
			 FROM fonderie_webhook_endpoint_bin
			 WHERE workspace_id = $1 AND deleted_at > now() - make_interval(days => $2)
			 ORDER BY deleted_at DESC`,
			[workspaceId, retentionDays],
		);
	}

	// Back from the bin, in ONE statement: the snapshot leaves the bin and the
	// row returns with its id, URL, events and secret — or nothing changes.
	async restore(id: string, workspaceId: string, retentionDays = BIN_RETENTION_DAYS): Promise<IWebhookEndpoint | null> {
		const [row] = await this.store.query<IWebhookEndpoint>(
			`WITH b AS (
			   DELETE FROM fonderie_webhook_endpoint_bin
			   WHERE id = $1 AND workspace_id = $2 AND deleted_at > now() - make_interval(days => $3)
			   RETURNING snapshot
			 ), r AS (
			   INSERT INTO fonderie_webhook_endpoints
			   SELECT (jsonb_populate_record(NULL::fonderie_webhook_endpoints, b.snapshot)).* FROM b
			   RETURNING *
			 )
			 SELECT ${COLS} FROM r`,
			[id, workspaceId, retentionDays],
		);
		return row ?? null;
	}

	// Gone for good — the owner's call (a rogue manager must not empty the bin).
	async purgeFromBin(id: string, workspaceId: string): Promise<boolean> {
		const rows = await this.store.query(
			`DELETE FROM fonderie_webhook_endpoint_bin WHERE id = $1 AND workspace_id = $2 RETURNING id`,
			[id, workspaceId],
		);
		return rows.length > 0;
	}

	findForEvent(workspaceId: string, eventType: string): Promise<IWebhookEndpoint[]> {
		return this.store.query<IWebhookEndpoint>(
			`SELECT ${COLS} FROM fonderie_webhook_endpoints
			 WHERE workspace_id = $1
			   AND enabled = true
			   AND (events = '{}' OR $2 = ANY(events))`,
			[workspaceId, eventType],
		);
	}
}

/**
 * Empty the undo bin of snapshots past the retention — run it from the app's
 * cron (daily is plenty). Answers how many went.
 */
export async function emptyEndpointBin(store: IStoreAdapter, options: { olderThanDays?: number } = {}): Promise<number> {
	const days = options.olderThanDays ?? BIN_RETENTION_DAYS;
	const rows = await store.query(
		`DELETE FROM fonderie_webhook_endpoint_bin WHERE deleted_at <= now() - make_interval(days => $1) RETURNING id`,
		[days],
	);
	return rows.length;
}
