import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useCustomer, useCustomers, useCustomerTags } from '../hooks';

const fakeCustomers = { marker: 'context-customers' } as unknown as CustomersClient;
const fakeClient = { customers: fakeCustomers } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('hooks resolve the customers client from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useCustomers();
	});
	const shape = returned as { customers: unknown[]; isLoading: boolean; refresh: unknown };
	assert.deepEqual(shape.customers, []);
	assert.equal(shape.isLoading, true);
	assert.equal(typeof shape.refresh, 'function');
});

test('a multi-arg hook resolves from context when the client is omitted', () => {
	renderWithProvider(() => {
		const { customer, updateCustomer } = useCustomer('cust-1');
		assert.equal(customer, null);
		assert.equal(typeof updateCustomer, 'function');
	});
});

test('an explicit client still works and bypasses context', () => {
	const explicit = Object.assign(Object.create(CustomersClient.prototype), {
		marker: 'explicit-customers',
	}) as CustomersClient;
	// No provider at all — the explicit argument must be enough, in both forms.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { tags, addTag } = useCustomerTags(explicit, 'cust-1');
				assert.deepEqual(tags, []);
				assert.equal(typeof addTag, 'function');
				const { refresh } = useCustomers(explicit, { search: 'a' });
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
						useCustomer(undefined, 'cust-1');
					},
				}),
			),
		/useCustomer: no client/,
	);
});
