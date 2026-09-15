// Catching a webhook event that was never registered.
//
// Two failures hide behind "the webhook doesn't work", and they need different
// instruments:
//
//   REGISTERED BUT NOT HANDLED — the event arrives, no branch matches, 200 and
//   nothing happens. Visible in traffic, so a warn-once log finds it.
//
//   HANDLED BUT NOT REGISTERED — nothing arrives at all. No error, no delivery,
//   no log line. "No dunning events yet" and "dunning will never fire" are
//   indistinguishable from inside the app. Only asking the provider what it was
//   configured to send can find this, which is what checkWebhookRegistration does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWebhookRegistration } from '../services/provider-health';
import {
	ALL_WEBHOOK_EVENTS,
	PAYMENT_WEBHOOK_EVENTS,
	SUBSCRIPTION_WEBHOOK_EVENTS,
	isConsumedWebhookEvent,
} from '../webhook-events';

const SUB_URL = 'https://api.example.com/billing/webhook';
const PAY_URL = 'https://api.example.com/billing/webhook/payment';
const URLS = { subscriptionUrl: SUB_URL, paymentUrl: PAY_URL };

const providerReturning = (regs: unknown) => ({
	listWebhookRegistrations: async () => regs as never,
});

test('a fully-configured account reports ok', async () => {
	const r = await checkWebhookRegistration(
		providerReturning([
			{ url: SUB_URL, enabledEvents: [...SUBSCRIPTION_WEBHOOK_EVENTS], status: 'enabled' },
			{ url: PAY_URL, enabledEvents: [...PAYMENT_WEBHOOK_EVENTS], status: 'enabled' },
		]),
		URLS,
	);
	assert.equal(r.ok, true);
	assert.deepEqual(r.endpoints.flatMap((e) => e.missing), []);
});

test('an event we handle but nobody registered is reported as missing', async () => {
	// The exact silent failure: dunning is implemented, and the endpoint was
	// never told to send invoice.payment_failed, so it can never run.
	const r = await checkWebhookRegistration(
		providerReturning([
			{
				url: SUB_URL,
				enabledEvents: SUBSCRIPTION_WEBHOOK_EVENTS.filter((e) => e !== 'invoice.payment_failed'),
				status: 'enabled',
			},
			{ url: PAY_URL, enabledEvents: [...PAYMENT_WEBHOOK_EVENTS], status: 'enabled' },
		]),
		URLS,
	);
	assert.equal(r.ok, false, 'a handler that can never fire must not report healthy');
	const sub = r.endpoints.find((e) => e.url === SUB_URL)!;
	assert.deepEqual(sub.missing, ['invoice.payment_failed']);
});

test('an endpoint that was never created reports every event missing', async () => {
	const r = await checkWebhookRegistration(providerReturning([]), URLS);
	assert.equal(r.ok, false);
	assert.equal(r.endpoints.length, 2);
	assert.deepEqual(
		r.endpoints.map((e) => e.registered),
		[false, false],
	);
	assert.deepEqual(r.endpoints[0]!.missing, [...SUBSCRIPTION_WEBHOOK_EVENTS]);
});

test('a disabled endpoint is not healthy even with every event selected', async () => {
	// Stripe keeps a disabled endpoint listed with its full event selection, so
	// checking only `missing` would call a silent endpoint correctly configured.
	const r = await checkWebhookRegistration(
		providerReturning([
			{ url: SUB_URL, enabledEvents: [...SUBSCRIPTION_WEBHOOK_EVENTS], status: 'disabled' },
		]),
		{ subscriptionUrl: SUB_URL },
	);
	assert.equal(r.ok, false, 'a disabled endpoint delivers nothing');
	assert.deepEqual(r.endpoints[0]!.missing, []);
});

test("the '*' wildcard counts as covering everything", async () => {
	const r = await checkWebhookRegistration(
		providerReturning([{ url: SUB_URL, enabledEvents: ['*'], status: 'enabled' }]),
		{ subscriptionUrl: SUB_URL },
	);
	assert.equal(r.ok, true);
	assert.deepEqual(r.endpoints[0]!.missing, []);
	assert.deepEqual(r.endpoints[0]!.unexpected, [], "'*' is not an unknown event name");
});

test('an extra registered event is reported but does NOT fail the check', async () => {
	const r = await checkWebhookRegistration(
		providerReturning([
			{
				url: SUB_URL,
				enabledEvents: [...SUBSCRIPTION_WEBHOOK_EVENTS, 'customer.created'],
				status: 'enabled',
			},
		]),
		{ subscriptionUrl: SUB_URL },
	);
	assert.equal(r.ok, true, 'an unconsumed event is noise, not breakage');
	assert.deepEqual(r.endpoints[0]!.unexpected, ['customer.created']);
});

test('a trailing slash is not a different endpoint', async () => {
	const r = await checkWebhookRegistration(
		providerReturning([
			{ url: `${SUB_URL}/`, enabledEvents: [...SUBSCRIPTION_WEBHOOK_EVENTS], status: 'enabled' },
		]),
		{ subscriptionUrl: SUB_URL },
	);
	assert.equal(r.ok, true);
	assert.equal(r.endpoints[0]!.registered, true);
});

test('a provider that cannot be asked reports unsupported, not failure', async () => {
	const r = await checkWebhookRegistration({}, URLS);
	assert.equal(r.unsupported, true);
	assert.equal(r.ok, true, 'absence of the capability is not evidence of a problem');
});

test('a provider that throws is reported, never rethrown', async () => {
	// A health check must not take down the route that reports on it.
	const r = await checkWebhookRegistration(
		{ listWebhookRegistrations: async () => { throw new Error('stripe unreachable'); } },
		URLS,
	);
	assert.equal(r.ok, false);
	assert.match(r.error ?? '', /stripe unreachable/);
});

test('only the endpoints this deployment serves are checked', async () => {
	const r = await checkWebhookRegistration(providerReturning([]), { paymentUrl: PAY_URL });
	assert.equal(r.endpoints.length, 1);
	assert.equal(r.endpoints[0]!.url, PAY_URL);
});

test('no duplicates, and an unconsumed type is not claimed', () => {
	assert.equal(
		ALL_WEBHOOK_EVENTS.length,
		new Set(ALL_WEBHOOK_EVENTS).size,
		'the declared list must not contain duplicates',
	);
	assert.equal(isConsumedWebhookEvent('customer.created'), false);
});

test('the declared list and the normalizer branches agree, in both directions', async () => {
	// The guard against this list quietly becoming a lie — the same failure mode
	// as `subscriberId: ''`: a value that looks authoritative and is not.
	//
	// The normalizer decides what is really handled, via `raw.type === '…'`
	// branches (plus SUBSCRIPTION_LIFECYCLE_EVENTS, which it now imports from
	// the same declaration). Comparing against the source catches BOTH drifts:
	// a branch added without updating the list (we never tell anyone to register
	// it → silent feature loss), and a branch deleted while the list keeps it
	// (we tell people to register an event nothing consumes).
	const fs = await import('node:fs');
	const src = fs.readFileSync(new URL('../providers/stripe.ts', import.meta.url), 'utf8');

	const branched = new Set(
		[...src.matchAll(/raw\.type\s*===\s*'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]!),
	);
	assert.ok(branched.size > 0, 'found no branches — the scan itself is broken');

	// Every type the normalizer branches on must be declared…
	for (const type of branched) {
		assert.ok(
			isConsumedWebhookEvent(type),
			`normalizer handles '${type}' but it is not in the declared list — ` +
				`nobody would be told to register it`,
		);
	}

	// …and every declared event must be reachable: either a literal branch, or a
	// member of the lifecycle set the normalizer tests against.
	const lifecycle = new Set<string>(SUBSCRIPTION_WEBHOOK_EVENTS);
	for (const type of ALL_WEBHOOK_EVENTS) {
		assert.ok(
			branched.has(type) || lifecycle.has(type),
			`'${type}' is declared but the normalizer has no branch for it`,
		);
	}
});

test('the two endpoints do not claim the same event', async () => {
	// checkout.session.completed belongs to the payment endpoint only. If both
	// lists claimed it, a single Stripe endpoint carrying both sets would look
	// correct while the event got processed twice.
	const overlap = SUBSCRIPTION_WEBHOOK_EVENTS.filter((e) =>
		(PAYMENT_WEBHOOK_EVENTS as readonly string[]).includes(e),
	);
	assert.deepEqual(overlap, [], 'an event owned by both endpoints would be processed twice');
});
