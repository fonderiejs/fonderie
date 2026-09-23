// Guards the request parameters StripeProvider puts on the wire.
//
// Why this is a SOURCE assertion and not a behavioural test: StripeProvider
// resolves its client through a module-level `await import('stripe')` behind a
// private `client()`, so nothing can inject a double. The result is that all
// ~26 outbound call shapes in providers/stripe.ts are untested — a real gap,
// recorded here rather than papered over. This file does not close it. It
// closes exactly one hole: sending a parameter the API rejects outright.
//
// That hole is not hypothetical. Dahlia made `payment_method_types` read-only
// on Payment Intents and Setup Intents; sending it returns
// 400 `payment_method_types_no_longer_supported`, which would break in-app
// card entry for every consumer on the first request. A grep is a poor test in
// general, but it is a precise one for "we must never send this key again".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { STRIPE_API_VERSION } from '../providers/stripe.js';

const SRC = readFileSync(join(import.meta.dirname, '../providers/stripe.ts'), 'utf8');

// Request keys only: `foo:` in an object literal we build. The read side is
// fine and must keep working — responses still CARRY payment_method_types, and
// normalisers may read it.
const sendsKey = (key: string) => new RegExp(`(?<!allowed_)(?<!excluded_)\\b${key}\\s*:`).test(SRC);

test('never sends payment_method_types — Dahlia 400s on it', () => {
	assert.equal(
		sendsKey('payment_method_types'),
		false,
		'providers/stripe.ts sends `payment_method_types:`. Dahlia rejects it with ' +
			'400 payment_method_types_no_longer_supported, breaking in-app card entry. ' +
			'Use `allowed_payment_method_types:` — it filters incompatible types out of ' +
			'the dynamic set instead of erroring.',
	);
});

test('restricts setup-intent methods explicitly, rather than not at all', () => {
	// Dropping the parameter entirely also "fixes" the 400 — and silently opens
	// card entry to wallet methods like Link, whose confirmed PM is type:'link'
	// with no `card` object and so cannot be shown as a card on file. The
	// restriction is the point; assert it is still there.
	assert.match(
		SRC,
		/allowed_payment_method_types:\s*this\.options\.setupPaymentMethodTypes/,
		'the SetupIntent no longer restricts payment method types to the configured ' +
			'list — wallet methods can now be saved as unusable "cards on file"',
	);
});

test('the pinned API version is the one these parameters belong to', () => {
	// allowed_payment_method_types does not exist before Dahlia. Pin and
	// parameter have to move together; either alone is broken.
	assert.match(STRIPE_API_VERSION, /\.dahlia$/, 'pin and wire parameters have drifted apart');
});
