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

	/**
	 * Record the delivery of one event to one endpoint — at most once. Null
	 * when a row for this (endpoint, event) already exists.
	 *
	 * The events outbox re-runs a dispatch whose consumer row was not marked
	 * processed (the process died, or the dispatch threw), so this is called
	 * again for the same event. A plain INSERT made a second row each time and
	 * the endpoint got the same webhook twice. The existing row is not handed
	 * back on purpose: it belongs to the dispatch that created it, or — if that
	 * one died before recording an attempt — to the retry loop once it goes
	 * stale (see claimForRetry). Sending it here as well is the duplicate.
	 */
	async create(data: {
		endpointId: string;
		eventId: string;
		eventType: string;
		payload: Record<string, unknown>;
	}): Promise<IWebhookDelivery | null> {
		const [row] = await this.store.query<IWebhookDelivery>(
			`INSERT INTO fonderie_webhook_deliveries (endpoint_id, event_id, event_type, payload)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (endpoint_id, event_id) DO NOTHING
			 RETURNING ${COLS}`,
			[data.endpointId, data.eventId, data.eventType, JSON.stringify(data.payload)],
		);
		return row ?? null;
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
	 *
	 * A 'pending' row is claimable too, once it is older than the lease. That is
	 * a row whose FIRST attempt was never recorded — the process died between
	 * inserting it and marking the result. Only 'failed' rows used to be
	 * claimed, so such a row was never sent at all; and since create() no
	 * longer inserts a second row on re-dispatch, this is now the only way it
	 * goes out. Its first lease is measured from created_at, because the
	 * dispatch that inserted it is attempting it right then.
	 */
	claimForRetry(limit = 10, leaseSeconds = 300): Promise<IPendingRetry[]> {
		return this.store.query<IPendingRetry>(
			`WITH locked AS (
			   SELECT d2.id
			   FROM   fonderie_webhook_deliveries d2
			   JOIN   fonderie_webhook_endpoints  e2 ON e2.id = d2.endpoint_id
			   WHERE  (
			            (d2.status = 'failed'
			             AND d2.next_attempt_at IS NOT NULL
			             AND d2.next_attempt_at <= now())
			            OR (d2.status = 'pending'
			                AND coalesce(d2.next_attempt_at,
			                             d2.created_at + make_interval(secs => $2)) <= now())
			          )
			     AND  e2.enabled = true
			   ORDER  BY coalesce(d2.next_attempt_at, d2.created_at)
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
