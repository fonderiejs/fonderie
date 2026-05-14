import type { IStoreAdapter } from '@fonderie-js/store';

import type { IWebhookEndpoint } from '../types';

const COLS = `id, workspace_id as "workspaceId", url, secret, events,
              enabled, created_at as "createdAt"`;

export class EndpointModel {
	constructor(private readonly store: IStoreAdapter) {}

	async create(data: {
		workspaceId: string;
		url:         string;
		secret:      string;
		events:      string[];
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
		id:          string,
		workspaceId: string,
		data: { url?: string; events?: string[]; enabled?: boolean },
	): Promise<IWebhookEndpoint | null> {
		const sets:   string[]  = [];
		const params: unknown[] = [id, workspaceId];

		if (data.url     !== undefined) { params.push(data.url);     sets.push(`url = $${params.length}`); }
		if (data.events  !== undefined) { params.push(data.events);  sets.push(`events = $${params.length}`); }
		if (data.enabled !== undefined) { params.push(data.enabled); sets.push(`enabled = $${params.length}`); }

		if (sets.length === 0) return this.findById(id, workspaceId);

		const [row] = await this.store.query<IWebhookEndpoint>(
			`UPDATE fonderie_webhook_endpoints SET ${sets.join(', ')}
			 WHERE id = $1 AND workspace_id = $2
			 RETURNING ${COLS}`,
			params,
		);
		return row ?? null;
	}

	async delete(id: string, workspaceId: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`DELETE FROM fonderie_webhook_endpoints WHERE id = $1 AND workspace_id = $2 RETURNING id`,
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
