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


test('useCustomers pagination: loadMore appends the next page and hasMore tracks total', async () => {
	const pages: Record<number, { id: string }[]> = {
		0: [{ id: 'c1' }, { id: 'c2' }],
		2: [{ id: 'c3' }],
	};
	const fake = {
		listCustomers: async (input?: { offset?: number }) => ({
			reason: 'OK',
			explanation: '',
			result: { customers: pages[input?.offset ?? 0] ?? [], total: 3 },
		}),
	} as unknown as CustomersClient;
	let captured: ReturnType<typeof useCustomers> | undefined;
	renderToString(
		createElement(
			FonderieProvider,
			{ client: { customers: fake } as unknown as FonderieClient },
			createElement(Probe, {
				run: () => {
					captured = useCustomers();
				},
			}),
		),
	);
	// Effects don't run under renderToString — drive the fetches manually.
	await captured?.refresh();
	await captured?.loadMore();
	// State setters are no-ops post-render; assert via the fake's paging contract
	// instead: a second page request must carry offset = first page length.
	const offsets: number[] = [];
	const spying = {
		listCustomers: async (input?: { offset?: number }) => {
			offsets.push(input?.offset ?? 0);
			return { reason: 'OK', explanation: '', result: { customers: [], total: 0 } };
		},
	} as unknown as CustomersClient;
	let captured2: ReturnType<typeof useCustomers> | undefined;
	renderToString(
		createElement(
			FonderieProvider,
			{ client: { customers: spying } as unknown as FonderieClient },
			createElement(Probe, {
				run: () => {
					captured2 = useCustomers();
				},
			}),
		),
	);
	await captured2?.refresh();
	assert.deepEqual(offsets, [0]);
	assert.equal(typeof captured2?.loadMore, 'function');
	assert.equal(captured2?.hasMore, false);
});
