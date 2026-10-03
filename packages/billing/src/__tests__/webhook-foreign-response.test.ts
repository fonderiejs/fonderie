import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { webhookController } from '../controllers/webhook.controller';
import { paymentWebhookController } from '../controllers/payment-webhook.controller';

// Regression: node-server hosts replace globalThis.Response after
// @fonderie/core has loaded. Core's refusals (Response.json) are then not
// `instanceof` the global, and the webhook routes used to mistake "secret not
// configured" / "missing signature" for a verified event and answer
// 200 {"received":true}. Reproduce the swap here so the test cannot pass on
// the global's identity.

const Original = globalThis.Response;

async function withForeignGlobalResponse<T>(fn: () => Promise<T>): Promise<T> {
	class SwappedResponse extends Original {}
	(globalThis as { Response: typeof Response }).Response = SwappedResponse;
	try {
		// Sanity: the swap reproduces the hazard (core's refusal is foreign).
		assert.equal(Response.json({}) instanceof globalThis.Response, false);
		return await fn();
	} finally {
		(globalThis as { Response: typeof Response }).Response = Original;
	}
}

const store: IStoreAdapter = {
	query: async <T = unknown>(): Promise<T[]> => [] as T[],
	transaction: async (fn) => fn(store),
};

function ctx(signature: string | null): IFonderieContext {
	return {
		meta: {},
		request: new Request('http://localhost/billing/webhook', {
			method: 'POST',
			headers: signature ? { 'stripe-signature': signature } : {},
			body: '{}',
		}),
	} as unknown as IFonderieContext;
}

function config(extra: Record<string, unknown>): IBillingConfig {
	return {
		provider: {
			name: 'stub',
			async constructEvent() {
				throw new Error('bad signature');
			},
		},
		plans: [{ name: 'free' }],
		successUrl: 'https://acme.example/s',
		cancelUrl: 'https://acme.example/c',
		...extra,
	} as unknown as IBillingConfig;
}

test('subscription webhook: no secret → 500 even when globalThis.Response is foreign', async () => {
	const res = await withForeignGlobalResponse(() =>
		webhookController(store, config({})).handle(ctx('t=1,v1=sig')),
	);
	assert.equal(res.status, 500);
});

test('subscription webhook: missing / invalid signature → 400 under a foreign Response', async () => {
	const cfg = config({ webhookSecret: 'whsec_aaaa-bbbb-cccc-dddd-eeee-ffff-gggg' });
	const missing = await withForeignGlobalResponse(() => webhookController(store, cfg).handle(ctx(null)));
	assert.equal(missing.status, 400);
	const invalid = await withForeignGlobalResponse(() =>
		webhookController(store, cfg).handle(ctx('t=1,v1=sig')),
	);
	assert.equal(invalid.status, 400);
});

test('payment webhook: no secret → 500, invalid signature → 400 under a foreign Response', async () => {
	const none = await withForeignGlobalResponse(() =>
		paymentWebhookController(store, config({})).handle(ctx('t=1,v1=sig')),
	);
	assert.equal(none.status, 500);
	const cfg = config({ wallet: { webhookSecret: 'whsec_aaaa-bbbb-cccc-dddd-eeee-ffff-gggg' } });
	const invalid = await withForeignGlobalResponse(() =>
		paymentWebhookController(store, cfg).handle(ctx('t=1,v1=sig')),
	);
	assert.equal(invalid.status, 400);
});
