import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { AuditClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useAuditEvents } from '../hooks';

const fakeAudit = { marker: 'context-audit' } as unknown as AuditClient;
const fakeClient = { audit: fakeAudit } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('useAuditEvents resolves the audit client from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useAuditEvents();
	});
	const shape = returned as { events: unknown[]; isLoading: boolean; loadMore: unknown };
	assert.equal(typeof shape.loadMore, 'function');
	assert.equal(Array.isArray(shape.events), true);
	assert.equal(shape.isLoading, true);
});

test('filters-first form resolves from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useAuditEvents({ limit: 10 });
	});
	const shape = returned as { refresh: unknown; hasMore: boolean };
	assert.equal(typeof shape.refresh, 'function');
	assert.equal(shape.hasMore, false);
});

test('an explicit client still works and bypasses context', () => {
	const explicit = Object.assign(Object.create(AuditClient.prototype) as AuditClient, {
		marker: 'explicit-audit',
	});
	// No provider at all — the explicit first argument must be enough.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { refresh } = useAuditEvents(explicit, {});
				assert.equal(typeof refresh, 'function');
			},
		}),
	);
});

test('useAuditEvents throws a named error without provider or argument', () => {
	assert.throws(
		() =>
			renderToString(
				createElement(Probe, {
					run: () => {
						useAuditEvents();
					},
				}),
			),
		/useAuditEvents: no client/,
	);
});
