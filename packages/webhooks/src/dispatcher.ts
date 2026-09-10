import type { IStoreAdapter } from '@fonderie/store';
import type { IEventMeta } from '@fonderie/events';

import type { IWebhooksConfig } from './config';
import type { IWebhookEndpoint, IWebhookDelivery } from './types';
import { EndpointModel } from './models/endpoint.model';
import { DeliveryModel } from './models/delivery.model';
import { signPayload } from './signing';
import { pinnedTransport, type WebhookTransport } from './ssrf';

// Cap on the delivery response body we buffer AND store per attempt. The
// receiving endpoint is caller-controlled: without a cap it can return
// arbitrarily large bodies that we'd hold in memory and persist on every
// delivery + retry (memory pressure + unbounded fonderie_webhook_deliveries
// growth). 4 KiB is plenty for the diagnostic purpose the field serves.
const MAX_RESPONSE_BODY_BYTES = 4 * 1024;

export class WebhookDispatcher {
	private readonly maxAttempts: number;
	private readonly retryDelays: number[];

	constructor(
		private readonly store: IStoreAdapter,
		private readonly config: IWebhooksConfig = {},
		// Injectable delivery transport — defaults to the SSRF-safe, DNS-pinned
		// sender. Overridable so unit tests stay hermetic (no live DNS/sockets).
		private readonly transport: WebhookTransport = pinnedTransport,
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
			// The transport re-validates + DNS-PINS at DELIVERY time (the URL was
			// validated at registration, but DNS can change), never follows
			// redirects, and returns a capped response body.
			const res = await this.transport(
				url,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Webhook-Signature': signature,
						'X-Webhook-Event': delivery.eventType,
						'X-Webhook-ID': delivery.id,
					},
					body,
					timeoutMs: 10_000,
				},
				MAX_RESPONSE_BODY_BYTES,
			);

			await deliveries.markResult(delivery.id, {
				ok: res.ok,
				responseStatus: res.status,
				responseBody: res.body,
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
