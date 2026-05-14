import type { IStoreAdapter } from '@fonderie-js/store';

import type { IWebhookDelivery } from '../types';

const COLS = `id, endpoint_id as "endpointId", event_id as "eventId",
              event_type as "eventType", payload, status, attempts,
              response_status as "responseStatus", response_body as "responseBody",
              next_attempt_at as "nextAttemptAt", delivered_at as "deliveredAt",
              created_at as "createdAt"`;

export interface IPendingRetry {
	delivery: IWebhookDelivery;
	url:      string;
	secret:   string;
}

export class DeliveryModel {
	constructor(private readonly store: IStoreAdapter) {}

	async create(data: {
		endpointId: string;
		eventId:    string;
		eventType:  string;
		payload:    Record<string, unknown>;
	}): Promise<IWebhookDelivery> {
		const [row] = await this.store.query<IWebhookDelivery>(
			`INSERT INTO fonderie_webhook_deliveries (endpoint_id, event_id, event_type, payload)
			 VALUES ($1, $2, $3, $4)
			 RETURNING ${COLS}`,
			[data.endpointId, data.eventId, data.eventType, JSON.stringify(data.payload)],
		);
		return row!;
	}

	async markResult(id: string, result: {
		ok:             boolean;
		responseStatus: number | null;
		responseBody:   string;
		nextAttemptAt:  Date | null;
	}): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_webhook_deliveries
			 SET status          = $2,
			     attempts        = attempts + 1,
			     response_status = $3,
			     response_body   = $4,
			     next_attempt_at = $5,
			     delivered_at    = $6
			 WHERE id = $1`,
			[
				id,
				result.ok ? 'delivered' : 'failed',
				result.responseStatus,
				result.responseBody,
				result.nextAttemptAt,
				result.ok ? new Date() : null,
			],
		);
	}

	listByEndpoint(endpointId: string, limit = 50): Promise<IWebhookDelivery[]> {
		return this.store.query<IWebhookDelivery>(
			`SELECT ${COLS} FROM fonderie_webhook_deliveries
			 WHERE endpoint_id = $1
			 ORDER BY created_at DESC
			 LIMIT $2`,
			[endpointId, limit],
		);
	}

	claimForRetry(limit = 10): Promise<IPendingRetry[]> {
		return this.store.query<IPendingRetry>(
			`SELECT d.${COLS.replace(/\n\s+/g, ' ')},
			        e.url, e.secret
			 FROM   fonderie_webhook_deliveries d
			 JOIN   fonderie_webhook_endpoints  e ON e.id = d.endpoint_id
			 WHERE  d.status = 'failed'
			   AND  d.next_attempt_at IS NOT NULL
			   AND  d.next_attempt_at <= now()
			   AND  e.enabled = true
			 ORDER  BY d.next_attempt_at
			 LIMIT  $1`,
			[limit],
		);
	}
}
