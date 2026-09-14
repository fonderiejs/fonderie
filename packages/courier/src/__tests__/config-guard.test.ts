import assert from 'node:assert/strict';
import test from 'node:test';

import { collectCourierConfigProblems } from '../config-guard';
import type { ICourierConfig } from '../config';

/**
 * Two ways a notice can be silently lost, and the guard has to catch both at
 * BOOT — not when the first user happens to trigger one.
 *
 *   • routed to a channel with no provider  → dispatcher drops it
 *   • has a default template but no route   → dispatcher logs and returns
 *
 * The second is the quieter one, and it is not hypothetical: three auth notices
 * were lost that way in a real app (oauth-linked, oauth-unlinked,
 * oauth-registration), and a password-revoked security notice would have
 * joined them. Nothing reported a problem — the outbox marks the event
 * PROCESSED, because it was: courier consumed it and chose to do nothing.
 */

const base = (over: Partial<ICourierConfig> = {}): ICourierConfig =>
	({ channels: {}, ...over }) as ICourierConfig;

test('a type with a default template but no channel is reported', async () => {
	const problems = collectCourierConfigProblems(
		base({
			channels: { 'email-verification': ['email'] },
			templates: {
				source: 'db',
				defaults: [
					{
						'email-verification': { subject: 's', text: 't' },
						'password-revoked': { subject: 's', text: 't' },
						'oauth-linked': { subject: 's', text: 't' },
					},
				],
			},
		} as never),
		['email'],
	);

	const unrouted = problems.find((p) => /routed to no channel/.test(p.message));
	assert.ok(unrouted, 'an unroutable message type must be reported at boot');
	assert.match(unrouted!.message, /password-revoked/);
	assert.match(unrouted!.message, /oauth-linked/);
	assert.ok(
		!/email-verification/.test(unrouted!.message),
		'a type that IS routed must not be named — a guard that cries wolf gets ignored',
	);
});

test('nothing is reported when every declared type is routed', async () => {
	const problems = collectCourierConfigProblems(
		base({
			channels: { 'email-verification': ['email'], 'password-revoked': ['email'] },
			templates: {
				source: 'db',
				defaults: [
					{
						'email-verification': { subject: 's', text: 't' },
						'password-revoked': { subject: 's', text: 't' },
					},
				],
			},
		} as never),
		['email'],
	);
	assert.equal(
		problems.filter((p) => /routed to no channel/.test(p.message)).length,
		0,
		'a correct config must be silent',
	);
});

test('an app shipping no defaults is not nagged', async () => {
	// Defaults are optional — an app may resolve every template from the DB.
	// With nothing declared there is nothing to compare against, and inventing a
	// complaint would punish a legitimate setup.
	const problems = collectCourierConfigProblems(
		base({ channels: { 'email-verification': ['email'] } }),
		['email'],
	);
	assert.equal(problems.filter((p) => /routed to no channel/.test(p.message)).length, 0);
});

test('a type mapped to an EMPTY channel list is deliberate, not drift', async () => {
	// An email-only product does not send the phone OTP. That is a decision, and
	// nagging about it forever is how a guard gets muted — at which point it
	// stops catching the real drift it exists for. An empty list says "on
	// purpose"; an ABSENT key is the mistake.
	const problems = collectCourierConfigProblems(
		base({
			channels: { 'email-verification': ['email'], 'phone-otp': [] },
			templates: {
				source: 'db',
				defaults: [
					{
						'email-verification': { subject: 's', text: 't' },
						'phone-otp': { subject: 's', text: 't' },
					},
				],
			},
		} as never),
		['email'],
	);
	assert.equal(
		problems.filter((p) => /routed to no channel/.test(p.message)).length,
		0,
		'an explicit opt-out must be silent',
	);
});

test('both gaps are reported together, not one masking the other', async () => {
	// A config can be wrong in both directions at once; reporting only the first
	// means fixing it reveals the second on the NEXT deploy.
	const problems = collectCourierConfigProblems(
		base({
			channels: { 'email-verification': ['sms'] }, // routed to an unregistered provider
			templates: {
				source: 'db',
				defaults: [
					{
						'email-verification': { subject: 's', text: 't' },
						'password-revoked': { subject: 's', text: 't' }, // routed nowhere
					},
				],
			},
		} as never),
		['email'],
	);
	assert.ok(problems.some((p) => /no 'sms' provider is registered/.test(p.message)));
	assert.ok(problems.some((p) => /routed to no channel/.test(p.message)));
});
