import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { BillingClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useCheckout, usePlan, usePlans } from '../hooks';

const fakeBilling = { marker: 'context-billing' } as unknown as BillingClient;
const fakeClient = { billing: fakeBilling } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('hooks resolve the billing client from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = usePlans();
	});
	const shape = returned as { plans: unknown[]; isLoading: boolean; refresh: unknown };
	assert.equal(typeof shape.refresh, 'function');
	assert.equal(Array.isArray(shape.plans), true);
	assert.equal(shape.isLoading, true);
});

test('overloaded hooks resolve from context when the client is omitted', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = usePlan('plan_pro');
	});
	const shape = returned as { plan: unknown; isLoading: boolean; refresh: unknown };
	assert.equal(typeof shape.refresh, 'function');
	assert.equal(shape.plan, null);
});

test('an explicit client still works and bypasses context', () => {
	const explicit = Object.assign(Object.create(BillingClient.prototype) as BillingClient, {
		marker: 'explicit-billing',
	});
	// No provider at all — the explicit first argument must be enough.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { refresh } = usePlan(explicit, 'plan_pro');
				assert.equal(typeof refresh, 'function');
			},
		}),
	);
});

test('hooks throw a named error without provider or argument', () => {
	assert.throws(
		() =>
			renderToString(
				createElement(Probe, {
					run: () => {
						useCheckout();
					},
				}),
			),
		/useCheckout: no client/,
	);
});
