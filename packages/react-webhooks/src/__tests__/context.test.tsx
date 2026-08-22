import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { WebhooksClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useWebhookDeliveries, useWebhookEndpoints } from '../hooks';

const fakeWebhooks = { marker: 'context-webhooks' } as unknown as WebhooksClient;
const fakeClient = { webhooks: fakeWebhooks } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('hooks resolve the webhooks client from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useWebhookEndpoints();
	});
	const shape = returned as { endpoints: unknown[]; isLoading: boolean; refresh: unknown };
	assert.equal(typeof shape.refresh, 'function');
	assert.equal(Array.isArray(shape.endpoints), true);
	assert.equal(shape.isLoading, true);
});

test('overloaded hooks resolve from context when the client is omitted', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useWebhookDeliveries('ep_1');
	});
	const shape = returned as { deliveries: unknown[]; refresh: unknown };
	assert.equal(typeof shape.refresh, 'function');
	assert.equal(Array.isArray(shape.deliveries), true);
});

test('an explicit client still works and bypasses context', () => {
	const explicit = Object.assign(Object.create(WebhooksClient.prototype) as WebhooksClient, {
		marker: 'explicit-webhooks',
	});
	// No provider at all — the explicit first argument must be enough.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { refresh } = useWebhookDeliveries(explicit, 'ep_1');
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
						useWebhookEndpoints();
					},
				}),
			),
		/useWebhookEndpoints: no client/,
	);
});

test('testEndpoint folds into useWebhookEndpoints and does not re-list', async () => {
	const log: unknown[] = [];
	const fake = {
		listEndpoints: async (opts?: { bust?: boolean }) => {
			log.push(['list', opts?.bust ?? false]);
			return { reason: 'OK', explanation: '', result: { endpoints: [] } };
		},
		testEndpoint: async (endpointId: string) => {
			log.push(['test', endpointId]);
			return { reason: 'OK', explanation: '', result: { ok: true } };
		},
	};
	let captured: ReturnType<typeof useWebhookEndpoints> | undefined;
	renderToString(
		createElement(
			FonderieProvider,
			{ client: { webhooks: fake } as unknown as FonderieClient },
			createElement(Probe, {
				run: () => {
					captured = useWebhookEndpoints();
				},
			}),
		),
	);
	const result = await captured?.testEndpoint('ep_9');
	assert.equal(result?.ok, true);
	// A test delivery doesn't change the endpoints list — no refresh call.
	assert.deepEqual(log, [['test', 'ep_9']]);
});
