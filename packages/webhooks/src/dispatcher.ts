import type { IStoreAdapter } from '@fonderie/store';
import type { IEventMeta } from '@fonderie/events';

import type { IWebhooksConfig } from './config';
import type { IWebhookEndpoint, IWebhookDelivery } from './types';
import { EndpointModel } from './models/endpoint.model';
import { DeliveryModel } from './models/delivery.model';
import { signPayload } from './signing';
import { assertPublicHttpUrl } from './ssrf';

// Cap on the delivery response body we buffer AND store per attempt. The
// receiving endpoint is caller-controlled: without a cap it can return
// arbitrarily large bodies that we'd hold in memory and persist on every
// delivery + retry (memory pressure + unbounded fonderie_webhook_deliveries
// growth). 4 KiB is plenty for the diagnostic purpose the field serves.
const MAX_RESPONSE_BODY_BYTES = 4 * 1024;

async function readBodyCapped(res: Response): Promise<string> {
	if (!res.body) return '';
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		const room = MAX_RESPONSE_BODY_BYTES - total;
		if (value.byteLength >= room) {
			chunks.push(value.slice(0, room));
			total += room;
			await reader.cancel().catch(() => undefined);
			break;
		}
		chunks.push(value);
		total += value.byteLength;
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		merged.set(c, offset);
		offset += c.byteLength;
	}
	return new TextDecoder().decode(merged);
}

export class WebhookDispatcher {
	private readonly maxAttempts: number;
	private readonly retryDelays: number[];

	constructor(
		private readonly store: IStoreAdapter,
		private readonly config: IWebhooksConfig = {},
		// Injectable SSRF guard — defaults to the real DNS-resolving check.
		// Overridable so unit tests stay hermetic (no live DNS lookups).
		private readonly assertUrlSafe: (url: string) => Promise<void> = assertPublicHttpUrl,
	) {
		this.maxAttempts = config.maxAttempts ?? 3;
		this.retryDelays = config.retryDelays ?? [60_000, 300_000, 1_800_000];
	}

	// Called by the bus consumer for every event.
	// Skips events that don't carry a workspaceId — not workspace-scoped.
	async dispatch(payload: Record<string, unknown>, meta: IEventMeta): Promise<void> {
		const workspaceId = payload['workspaceId'];
		if (typeof workspaceId !== 'string') return;

		const endpoints = await new EndpointModel(this.store).findForEvent(workspaceId, meta.type);
		if (endpoints.length === 0) return;

		const deliveries = new DeliveryModel(this.store);
		await Promise.allSettled(endpoints.map((ep) => this.deliver(ep, payload, meta, deliveries)));
	}

	// Retries failed deliveries whose next_attempt_at has passed.
	async retry(): Promise<void> {
		const deliveries = new DeliveryModel(this.store);
		const pending = await deliveries.claimForRetry();
		await Promise.allSettled(
			pending.map(({ url, secret, ...delivery }) =>
				this.attemptDelivery(url, secret, delivery, deliveries),
			),
		);
	}

	private async deliver(
		endpoint: IWebhookEndpoint,
		payload: Record<string, unknown>,
		meta: IEventMeta,
		deliveries: DeliveryModel,
	): Promise<void> {
		const delivery = await deliveries.create({
			endpointId: endpoint.id,
			eventId: meta.id,
			eventType: meta.type,
			payload,
		});
		await this.attemptDelivery(endpoint.url, endpoint.secret, delivery, deliveries);
	}

	async attemptDelivery(
		url: string,
		secret: string,
		delivery: IWebhookDelivery,
		deliveries: DeliveryModel,
	): Promise<void> {
		const body = JSON.stringify({
			id: delivery.eventId,
			type: delivery.eventType,
			data: delivery.payload,
		});

		const signature = signPayload(secret, body);

		try {
			// SSRF guard at DELIVERY time — the URL was validated at registration,
			// but DNS can change, so re-check the resolved address on every send.
			await this.assertUrlSafe(url);
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Webhook-Signature': signature,
					'X-Webhook-Event': delivery.eventType,
					'X-Webhook-ID': delivery.id,
				},
				body,
				// Never follow redirects: a public host must not be able to 302 the
				// request into an internal address after the guard above passed.
				redirect: 'manual',
				signal: AbortSignal.timeout(10_000),
			});

			const responseBody = await readBodyCapped(res).catch(() => '');

			await deliveries.markResult(delivery.id, {
				ok: res.ok,
				responseStatus: res.status,
				responseBody,
				nextAttemptAt: res.ok ? null : this.nextRetryAt(delivery.attempts),
			});
		} catch (err) {
			await deliveries.markResult(delivery.id, {
				ok: false,
				responseStatus: null,
				responseBody: err instanceof Error ? err.message : String(err),
				nextAttemptAt: this.nextRetryAt(delivery.attempts),
			});
		}
	}

	private nextRetryAt(currentAttempts: number): Date | null {
		if (currentAttempts + 1 >= this.maxAttempts) return null;
		const delay =
			this.retryDelays[currentAttempts] ?? this.retryDelays[this.retryDelays.length - 1]!;
		return new Date(Date.now() + delay);
	}
}
