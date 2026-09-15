// A subscription webhook whose provider metadata carries no subscriberId.
//
// Real subscriptions reach this state routinely — created in the provider's
// dashboard, imported from another system, restored from a backup, or a
// synthetic test event from the provider's CLI. The normalizer represents the
// absence as subscriberId '' (providers/stripe.ts), and '' is not a uuid, so
// every one of these used to reach the store and raise
//   invalid input syntax for type uuid: ""
// turning the webhook into a 500. That is the worst available answer: the
// provider reads 500 as transient and redelivers the same un-actionable event
// on a backoff schedule, so one unowned subscription becomes a permanent stream
// of failing deliveries.
//
// These tests pin the two halves of the fix: recover the identity from our own
// table when we do own the subscription, and decline with 200 when we do not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { webhookController } from '../controllers/webhook.controller';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

// A subscription event with EMPTY subscriber metadata — the case that used to
// throw. Every other field is well-formed, so nothing but the missing
// subscriberId can be responsible for the outcome.
function eventWithoutSubscriberMetadata(type: string) {
	return {
		type,
		eventAt: new Date('2026-01-01T00:00:00Z'),
		subscription: {
			subscriberType: 'workspace',
			subscriberId: '', // ← the whole point
			plan: 'unknown',
			priceLookupKey: null,
			priceId: 'price_x',
			status: 'active',
			providerCustomerId: 'cus_x',
			providerSubscriptionId: 'sub_orphan',
			currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
			currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
			cancelAtPeriodEnd: false,
			trialEndsAt: null,
			interval: 'month',
		},
	};
}

function makeCtx() {
	return {
		request: new Request('http://localhost/billing/webhook', {
			method: 'POST',
			headers: { 'stripe-signature': 't=1,v1=stub' },
			body: '{}',
		}),
		meta: {},
	} as never;
}

function makeConfig(event: unknown) {
	return {
		provider: { name: 'stub', async constructEvent() { return event; } },
		webhookSecret: 'whsec_x',
		plans: [],
	} as never;
}

/**
 * Records every statement AND its parameters, so a test can assert both what
 * did not run and which identity was actually written.
 */
function recordingStore(rowsFor: (sql: string) => unknown[]) {
	const calls: { sql: string; params: unknown[] }[] = [];
	const run = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
		calls.push({ sql: text, params });
		return rowsFor(text) as T[];
	};
	return {
		calls,
		sql: { get length() { return calls.length; } },
		store: {
			query: run,
			transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
				fn({ query: run }),
		} as never,
	};
}

test('unowned subscription is declined with 200, without touching subscriber state', async () => {
	// Nothing in our table matches this provider subscription id.
	const { store, calls } = recordingStore(() => []);
	const controller = webhookController(
		store,
		makeConfig(eventWithoutSubscriberMetadata('customer.subscription.created')),
	);

	const res = await controller.handle(makeCtx());

	assert.equal(res.status, 200, 'must not 500 — a 5xx makes the provider retry a poison event forever');
	assert.deepEqual(await res.json(), { received: true, ignored: 'no-subscriber-metadata' });

	// The regression itself: the empty-string id must never be handed to a uuid
	// column. Asserting on recorded PARAMS (not just statement text) is what
	// makes this a real check — it fails if any future branch passes '' along.
	const emptyId = calls.filter((c) => c.params.includes(''));
	assert.deepEqual(
		emptyId.map((c) => c.sql.slice(0, 60)),
		[],
		'no statement may carry an empty-string subscriber id',
	);
});

test('a subscription we own but whose metadata was stripped is recovered, not dropped', async () => {
	// Same empty metadata — but provider_subscription_id matches a row we own,
	// so the identity IS recoverable and the event must still be applied under
	// the recovered id.
	const { store, calls } = recordingStore((s) =>
		/provider_subscription_id/i.test(s) && /select/i.test(s)
			? [{ subscriberType: 'workspace', subscriberId: OWNER_ID }]
			: [],
	);
	const controller = webhookController(
		store,
		makeConfig(eventWithoutSubscriberMetadata('customer.subscription.updated')),
	);

	const res = await controller.handle(makeCtx());

	assert.equal(res.status, 200);
	assert.notEqual(
		((await res.json()) as { ignored?: string }).ignored,
		'no-subscriber-metadata',
		'recoverable identity must NOT be declined — dropping it silently desyncs a real subscription',
	);

	// The assertion that actually distinguishes fixed from broken: the RECOVERED
	// owner id has to reach the write. Without the guard the write either never
	// happens or carries '', so this cannot pass by accident.
	assert.ok(
		calls.some((c) => c.params.includes(OWNER_ID)),
		'the recovered owner id must be used for the subscription write',
	);
	assert.ok(
		!calls.some((c) => c.params.includes('')),
		'the empty id must not survive recovery',
	);
});

test('trial_will_end with no subscriber metadata is declined before it can notify', async () => {
	// This branch runs BEFORE the generic subscription path and reaches
	// notifyBilling → recipient lookup, so it needs the same guard. A test here
	// stops the fix from being narrowed to the upsert path alone.
	const { store } = recordingStore(() => []);
	const controller = webhookController(
		store,
		makeConfig(eventWithoutSubscriberMetadata('customer.subscription.trial_will_end')),
	);

	const res = await controller.handle(makeCtx());

	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { received: true, ignored: 'no-subscriber-metadata' });
});
