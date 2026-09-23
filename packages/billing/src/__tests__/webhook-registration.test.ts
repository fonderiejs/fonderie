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
import { checkWebhookRegistration, describeWebhookProblems } from '../services/provider-health';
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
	assert.deepEqual(
		r.endpoints.flatMap((e) => e.missing),
		[],
	);
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
		{
			listWebhookRegistrations: async () => {
				throw new Error('stripe unreachable');
			},
		},
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

// ---------------------------------------------------------------------------
// A THIRD failure, distinct from both at the top of this file: the events are
// registered AND they arrive — shaped differently than the code expects.
//
// A provider renders webhook payloads in the version set on the ENDPOINT, in
// its dashboard, not the version this client pins in code. Those are two
// different places and nothing holds them together. Stripe moved the
// subscription and the PaymentIntent off the Invoice object between them, so
// the ids parsed to null, the controller answered 200 `ignored`, and the
// provider recorded a successful delivery. Nothing retried and nothing logged.
//
// The normalizers now read old and new locations both, so a difference is
// survivable — but the NEXT field to move is invisible again unless the two
// versions are compared out loud.
// ---------------------------------------------------------------------------

const PINNED = '2024-11-20.acacia';
const providerPinned = (regs: unknown, apiVersion: string = PINNED) => ({
	apiVersion,
	listWebhookRegistrations: async () => regs as never,
});
// A provider that pins no version has no such key at all — not a key set to
// undefined, which a defaulted parameter would quietly turn back into the pin.
const providerNoPin = (regs: unknown) => ({
	listWebhookRegistrations: async () => regs as never,
});
const enabled = (url: string, events: readonly string[], apiVersion?: string) => ({
	url,
	enabledEvents: [...events],
	status: 'enabled',
	...(apiVersion ? { apiVersion } : {}),
});

test('an endpoint on the pinned version reports no mismatch', async () => {
	const r = await checkWebhookRegistration(
		providerPinned([
			enabled(SUB_URL, SUBSCRIPTION_WEBHOOK_EVENTS, PINNED),
			enabled(PAY_URL, PAYMENT_WEBHOOK_EVENTS, PINNED),
		]),
		URLS,
	);
	assert.equal(r.expectedApiVersion, PINNED);
	assert.deepEqual(
		r.endpoints.map((e) => e.apiVersionMismatch),
		[false, false],
	);
	assert.deepEqual(describeWebhookProblems(r), []);
});

test('an endpoint on a DIFFERENT version is flagged — the real-world case', async () => {
	const r = await checkWebhookRegistration(
		providerPinned([
			enabled(SUB_URL, SUBSCRIPTION_WEBHOOK_EVENTS, '2026-04-22.dahlia'),
			enabled(PAY_URL, PAYMENT_WEBHOOK_EVENTS, PINNED),
		]),
		URLS,
	);
	assert.equal(r.endpoints[0]!.apiVersionMismatch, true);
	assert.equal(r.endpoints[0]!.apiVersion, '2026-04-22.dahlia');
	assert.equal(r.endpoints[1]!.apiVersionMismatch, false);

	const lines = describeWebhookProblems(r);
	assert.equal(lines.length, 1);
	assert.match(lines[0]!, /2026-04-22\.dahlia/);
	assert.match(lines[0]!, /2024-11-20\.acacia/);

	// It must NOT claim data is being lost. Invoice payloads have been read
	// version-tolerantly since 9.6.0, so the old wording ("a payload can parse
	// to null and be silently ignored") described a consequence that no longer
	// follows — and an attention page that overstates gets ignored wholesale.
	assert.doesNotMatch(lines[0]!, /parse to null|silently ignored/);

	// And it must name the remedy, because the obvious one does not exist: an
	// endpoint's version is fixed when the endpoint is created. Someone reading
	// this went looking for the field and found "This field cannot be changed".
	assert.match(lines[0]!, /cannot be changed after it is created/);
	assert.match(lines[0]!, /recreate it|move the client pin/);
});

test('a version difference does NOT flip ok — that is reserved for "will it arrive"', async () => {
	// Deliberate: a difference is legitimate and can be long-lived, and a report
	// that is permanently not-ok is one people stop reading. It surfaces through
	// describeWebhookProblems instead.
	const r = await checkWebhookRegistration(
		providerPinned([
			enabled(SUB_URL, SUBSCRIPTION_WEBHOOK_EVENTS, '2026-04-22.dahlia'),
			enabled(PAY_URL, PAYMENT_WEBHOOK_EVENTS, '2026-04-22.dahlia'),
		]),
		URLS,
	);
	assert.equal(r.ok, true);
	assert.equal(describeWebhookProblems(r).length, 2, 'still reported, just not via ok');
});

test('no comparison is made when either side does not state a version', async () => {
	// Silence beats a guess: an unknown on either side is not evidence of a
	// difference, and a check that invents findings gets muted.
	const noPin = await checkWebhookRegistration(
		providerNoPin([enabled(SUB_URL, SUBSCRIPTION_WEBHOOK_EVENTS, '2026-04-22.dahlia')]),
		{ subscriptionUrl: SUB_URL },
	);
	assert.equal(noPin.endpoints[0]!.apiVersionMismatch, undefined);
	assert.equal(noPin.expectedApiVersion, undefined);
	assert.deepEqual(describeWebhookProblems(noPin), []);

	const noEndpointVersion = await checkWebhookRegistration(
		providerPinned([enabled(SUB_URL, SUBSCRIPTION_WEBHOOK_EVENTS)]),
		{ subscriptionUrl: SUB_URL },
	);
	assert.equal(noEndpointVersion.endpoints[0]!.apiVersionMismatch, undefined);
	assert.deepEqual(describeWebhookProblems(noEndpointVersion), []);
});

test('describeWebhookProblems reports the delivery failures too, one line each', async () => {
	const r = await checkWebhookRegistration(
		providerPinned([
			{ url: SUB_URL, enabledEvents: ['customer.subscription.created'], status: 'disabled' },
			// PAY_URL absent entirely.
		]),
		URLS,
	);
	const lines = describeWebhookProblems(r);
	assert.ok(lines.some((l) => /DISABLED/.test(l)));
	assert.ok(lines.some((l) => /not registered for/.test(l)));
	assert.ok(lines.some((l) => l.includes(PAY_URL) && /NOT REGISTERED/.test(l)));
	assert.equal(r.ok, false);
});

test('an unreachable provider is described, never rethrown', async () => {
	const r = await checkWebhookRegistration(
		{
			apiVersion: PINNED,
			listWebhookRegistrations: async () => {
				throw new Error('stripe down');
			},
		},
		URLS,
	);
	assert.equal(r.ok, false);
	assert.deepEqual(describeWebhookProblems(r), ['webhook check failed: stripe down']);
});
