import type { IStoreAdapter } from '@fonderie/store';

import type { IWebhookDelivery } from '../types';

const COLS = `id, endpoint_id as "endpointId", event_id as "eventId",
              event_type as "eventType", payload, status, attempts,
              response_status as "responseStatus", response_body as "responseBody",
              next_attempt_at as "nextAttemptAt", delivered_at as "deliveredAt",
              created_at as "createdAt"`;

const D_COLS = `d.id, d.endpoint_id as "endpointId", d.event_id as "eventId",
                d.event_type as "eventType", d.payload, d.status, d.attempts,
                d.response_status as "responseStatus", d.response_body as "responseBody",
                d.next_attempt_at as "nextAttemptAt", d.delivered_at as "deliveredAt",
                d.created_at as "createdAt"`;

// A failed delivery joined with its endpoint's url/secret — FLAT, exactly as
// the claim query's row comes back. (This was once declared as a nested
// { delivery, url, secret } shape that no SQL row ever produced; the retry
// loop then threw on `delivery.eventId` for every claimed row, so failed
// deliveries were re-claimed forever and never actually retried.)
export type IPendingRetry = IWebhookDelivery & { url: string; secret: string };

export class DeliveryModel {
	constructor(private readonly store: IStoreAdapter) {}

	async create(data: {
		endpointId: string;
		eventId: string;
		eventType: string;
		payload: Record<string, unknown>;
	}): Promise<IWebhookDelivery> {
		const [row] = await this.store.query<IWebhookDelivery>(
			`INSERT INTO fonderie_webhook_deliveries (endpoint_id, event_id, event_type, payload)
			 VALUES ($1, $2, $3, $4)
			 RETURNING ${COLS}`,
			[data.endpointId, data.eventId, data.eventType, JSON.stringify(data.payload)],
		);
		return row!;
	}

	async markResult(
		id: string,
		result: {
			ok: boolean;
			responseStatus: number | null;
			responseBody: string;
			nextAttemptAt: Date | null;
		},
	): Promise<void> {
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

	/**
	 * Take ownership of up to `limit` deliveries that are due for another
	 * attempt. Claiming is EXCLUSIVE: two callers get disjoint sets.
	 *
	 * It used to be a plain SELECT, which claimed nothing — so every concurrent
	 * caller read the same rows and delivered them all. One long-running server
	 * with one timer never noticed; more than one of anything (several warm
	 * serverless instances, a container plus a scheduled ping) sent the same
	 * webhook to the customer's endpoint repeatedly. Webhooks are outward-facing,
	 * so that duplicate is someone else's system acting on the same event twice.
	 *
	 * The claim pushes `next_attempt_at` out by `leaseSeconds`, which doubles as
	 * crash recovery: `markResult` overwrites it with the real backoff (or null
	 * on success), and a process that dies mid-attempt simply leaves the row to
	 * become due again once the lease expires.
	 */
	claimForRetry(limit = 10, leaseSeconds = 300): Promise<IPendingRetry[]> {
		return this.store.query<IPendingRetry>(
			`WITH locked AS (
			   SELECT d2.id
			   FROM   fonderie_webhook_deliveries d2
			   JOIN   fonderie_webhook_endpoints  e2 ON e2.id = d2.endpoint_id
			   WHERE  d2.status = 'failed'
			     AND  d2.next_attempt_at IS NOT NULL
			     AND  d2.next_attempt_at <= now()
			     AND  e2.enabled = true
			   ORDER  BY d2.next_attempt_at
			   LIMIT  $1
			   FOR UPDATE OF d2 SKIP LOCKED
			 ), claimed AS (
			   UPDATE fonderie_webhook_deliveries d
			      SET next_attempt_at = now() + make_interval(secs => $2)
			     FROM locked
			    WHERE d.id = locked.id
			   RETURNING ${D_COLS}
			 )
			 SELECT c.*, e.url, e.secret
			 FROM   claimed c
			 JOIN   fonderie_webhook_endpoints e ON e.id = c."endpointId"`,
			[limit, leaseSeconds],
		);
	}
}
