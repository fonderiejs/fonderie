// An event delivered to the WRONG endpoint.
//
// The first version of this warning asked "does this package consume this type
// anywhere?" — which misses the common misconfiguration by construction. An
// event ticked on BOTH endpoints when only one handles it IS consumed, just not
// here, so a global check stays silent while every such event is delivered
// twice, processed once and ignored once. Observed in production: a payment
// endpoint registered for all fourteen types instead of its eight.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	warnOnUnconsumedEvent,
	__resetUnconsumedWarningsForTests,
} from '../controllers/webhook-shared';
import { PAYMENT_WEBHOOK_EVENTS, SUBSCRIPTION_WEBHOOK_EVENTS } from '../webhook-events';

/** Capture console.warn for one call. */
function captureWarn(fn: () => void): string[] {
	const out: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => {
		out.push(args.join(' '));
	};
	try {
		fn();
	} finally {
		console.warn = original;
	}
	return out;
}

test('an event handled by the OTHER endpoint warns about double delivery', () => {
	__resetUnconsumedWarningsForTests();
	// invoice.paid is consumed by the package — but by the subscription endpoint.
	// The old global check returned early here and said nothing.
	const lines = captureWarn(() =>
		warnOnUnconsumedEvent('invoice.paid', 'POST /billing/webhook/payment', PAYMENT_WEBHOOK_EVENTS),
	);
	assert.equal(lines.length, 1, 'wrong-endpoint delivery must not be silent');
	assert.match(lines[0]!, /DIFFERENT endpoint/);
	assert.match(lines[0]!, /delivered twice/, 'the message must name the actual consequence');
});

test('an event nothing consumes still warns, with the other message', () => {
	__resetUnconsumedWarningsForTests();
	const lines = captureWarn(() =>
		warnOnUnconsumedEvent('customer.created', 'POST /billing/webhook', SUBSCRIPTION_WEBHOOK_EVENTS),
	);
	assert.equal(lines.length, 1);
	assert.match(lines[0]!, /no handler consumes/);
	assert.doesNotMatch(lines[0]!, /DIFFERENT endpoint/, 'the two causes need different fixes');
});

test("an endpoint's own event is silent", () => {
	__resetUnconsumedWarningsForTests();
	const lines = captureWarn(() =>
		warnOnUnconsumedEvent('invoice.paid', 'POST /billing/webhook', SUBSCRIPTION_WEBHOOK_EVENTS),
	);
	assert.deepEqual(lines, []);
});

test('warns once per route+type, not once per type', () => {
	__resetUnconsumedWarningsForTests();
	// Keyed by route as well: the same type at two endpoints is two distinct
	// facts, and collapsing them would hide the second.
	const lines = captureWarn(() => {
		warnOnUnconsumedEvent('customer.created', 'POST /billing/webhook', SUBSCRIPTION_WEBHOOK_EVENTS);
		warnOnUnconsumedEvent('customer.created', 'POST /billing/webhook', SUBSCRIPTION_WEBHOOK_EVENTS);
		warnOnUnconsumedEvent(
			'customer.created',
			'POST /billing/webhook/payment',
			PAYMENT_WEBHOOK_EVENTS,
		);
	});
	assert.equal(lines.length, 2, 'deduped per route+type, so each endpoint reports once');
});

test('without an expected set it falls back to the package-wide check', () => {
	__resetUnconsumedWarningsForTests();
	// Back-compat for a caller that passes no set — silent on invoice.paid,
	// which is exactly the blind spot this change exists to remove.
	const lines = captureWarn(() =>
		warnOnUnconsumedEvent('invoice.paid', 'POST /billing/webhook/payment'),
	);
	assert.deepEqual(lines, [], 'the global fallback cannot see wrong-endpoint delivery');
});
