import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBillingRoutes } from '../routes';
import { STEP_UP_VERIFIER, requireStepUp } from '../middlewares/require-step-up';

// Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): ending a plan AT ONCE asks
// for a fresh proof it's the person; cancelling at period end does not.

const ctx = (body: unknown, verifier?: (c: unknown) => Promise<boolean>) =>
	({ meta: { body, ...(verifier ? { [STEP_UP_VERIFIER]: verifier } : {}) } }) as never;
const next = async () => new Response('next', { status: 200 });
const immediate = (c: { meta: { body?: { atPeriodEnd?: boolean } } }) => c.meta.body?.atPeriodEnd === false;

test('an immediate cancel without a fresh proof answers 403 STEP_UP_REQUIRED', async () => {
	const res = await requireStepUp(immediate as never)(ctx({ atPeriodEnd: false }, async () => false), next);
	assert.equal(res.status, 403);
	assert.equal(((await res.json()) as { reason: string }).reason, 'STEP_UP_REQUIRED');
});

test('with a fresh proof it goes through; at period end it is never asked', async () => {
	assert.equal((await requireStepUp(immediate as never)(ctx({ atPeriodEnd: false }, async () => true), next)).status, 200);
	assert.equal((await requireStepUp(immediate as never)(ctx({ atPeriodEnd: true }), next)).status, 200, 'no verifier needed');
	assert.equal((await requireStepUp(immediate as never)(ctx({}), next)).status, 200, 'the default is at period end');
});

test('no verifier installed (auth missing or too old): refused, never waved through', async () => {
	const res = await requireStepUp(immediate as never)(ctx({ atPeriodEnd: false }), next);
	assert.equal(res.status, 500);
});

test('the cancel route carries the guard, and stepUp: false removes exactly it', () => {
	const stub = { query: async () => [], transaction: async (fn: (t: unknown) => unknown) => fn(stub) } as never;
	const len = (config: object) =>
		buildBillingRoutes(stub, { plans: [], provider: { name: 'stub' }, ...config } as never).find(
			([m, p]) => m === 'POST' && p === '/billing/subscription/cancel',
		)!.length;
	assert.equal(len({}) - len({ stepUp: false }), 1);
});
