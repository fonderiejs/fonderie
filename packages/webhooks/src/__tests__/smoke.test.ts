import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryTransport } from '@fonderie-js/events';
import { EventBus } from '@fonderie-js/events';
import type { IEventMeta } from '@fonderie-js/events';

import { WebhookDispatcher } from '../dispatcher';
import { signPayload } from '../signing';

// ── stub store ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeStore(
	tables: Partial<{ fonderie_webhook_endpoints: Row[]; fonderie_webhook_deliveries: Row[] }> = {},
) {
	const db = {
		fonderie_webhook_endpoints: [] as Row[],
		fonderie_webhook_deliveries: [] as Row[],
		...tables,
	};

	return {
		db,
		query: async <T = Row>(sql: string, params: unknown[] = []): Promise<T[]> => {
			const s = sql.replace(/\s+/g, ' ').trim();

			if (s.startsWith('INSERT INTO fonderie_webhook_endpoints')) {
				const [workspaceId, url, secret, events] = params as [string, string, string, string[]];
				const row: Row = {
					id: `ep-${db.fonderie_webhook_endpoints.length + 1}`,
					workspaceId,
					url,
					secret,
					events,
					enabled: true,
					createdAt: new Date(),
				};
				db.fonderie_webhook_endpoints.push(row);
				return [row] as unknown as T[];
			}

			if (s.startsWith('INSERT INTO fonderie_webhook_deliveries')) {
				const [endpointId, eventId, eventType, payload] = params as [
					string,
					string,
					string,
					string,
				];
				const row: Row = {
					id: `del-${db.fonderie_webhook_deliveries.length + 1}`,
					endpointId,
					eventId,
					eventType,
					payload: JSON.parse(payload as string),
					status: 'pending',
					attempts: 0,
					responseStatus: null,
					responseBody: null,
					nextAttemptAt: null,
					deliveredAt: null,
					createdAt: new Date(),
				};
				db.fonderie_webhook_deliveries.push(row);
				return [row] as unknown as T[];
			}

			if (s.includes('UPDATE fonderie_webhook_deliveries') && s.includes('SET status')) {
				const [id, status, responseStatus, responseBody, nextAttemptAt, deliveredAt] =
					params as unknown[];
				const row = db.fonderie_webhook_deliveries.find((r) => r['id'] === id);
				if (row) {
					Object.assign(row, {
						status,
						responseStatus,
						responseBody,
						nextAttemptAt,
						deliveredAt,
						attempts: (row['attempts'] as number) + 1,
					});
				}
				return [];
			}

			if (
				s.includes('fonderie_webhook_endpoints') &&
				s.includes('workspace_id = $1') &&
				s.includes('ANY(events)')
			) {
				const [workspaceId, eventType] = params as [string, string];
				return db.fonderie_webhook_endpoints.filter(
					(r) =>
						r['workspaceId'] === workspaceId &&
						r['enabled'] === true &&
						((r['events'] as string[]).length === 0 ||
							(r['events'] as string[]).includes(eventType as string)),
				) as unknown as T[];
			}

			if (
				(s.includes('fonderie_webhook_deliveries') && s.includes('LEFT JOIN')) ||
				s.includes('JOIN fonderie_webhook_endpoints')
			) {
				return [] as T[];
			}

			return [] as T[];
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
	};
}

function makeMeta(type: string): IEventMeta {
	return { id: 'evt-1', type, emittedAt: new Date().toISOString(), attempts: 0 };
}

// ── signing ───────────────────────────────────────────────────────

test('signPayload: produces sha256= prefixed signature', () => {
	const sig = signPayload('secret', 'body');
	assert.ok(sig.startsWith('sha256='));
	assert.equal(sig.length, 71); // sha256= + 64 hex chars
});

test('signPayload: same secret + body produces same signature', () => {
	assert.equal(signPayload('s', 'b'), signPayload('s', 'b'));
});

test('signPayload: different body produces different signature', () => {
	assert.notEqual(signPayload('s', 'b1'), signPayload('s', 'b2'));
});

// ── dispatcher ────────────────────────────────────────────────────

test('dispatch: skips event with no workspaceId', async () => {
	const store = makeStore();
	const d = new WebhookDispatcher(store as never);
	await d.dispatch({ userId: 'u-1' }, makeMeta('user.registered'));
	assert.equal(store.db.fonderie_webhook_deliveries.length, 0);
});

test('dispatch: skips event when no matching endpoints', async () => {
	const store = makeStore();
	const d = new WebhookDispatcher(store as never);
	await d.dispatch({ workspaceId: 'ws-1' }, makeMeta('project.created'));
	assert.equal(store.db.fonderie_webhook_deliveries.length, 0);
});

test('dispatch: creates delivery and marks it delivered on 2xx', async () => {
	const store = makeStore();

	store.db.fonderie_webhook_endpoints.push({
		id: 'ep-1',
		workspaceId: 'ws-1',
		url: 'https://example.com/hook',
		secret: 'sec',
		events: [],
		enabled: true,
		createdAt: new Date(),
	});

	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('ok', { status: 200 }) as never;

	const d = new WebhookDispatcher(store as never);
	await d.dispatch({ workspaceId: 'ws-1' }, makeMeta('project.created'));

	globalThis.fetch = origFetch;

	assert.equal(store.db.fonderie_webhook_deliveries.length, 1);
	assert.equal(store.db.fonderie_webhook_deliveries[0]!['status'], 'delivered');
});

test('dispatch: filters endpoints by event type', async () => {
	const store = makeStore();

	store.db.fonderie_webhook_endpoints.push(
		{
			id: 'ep-1',
			workspaceId: 'ws-1',
			url: 'https://a.com',
			secret: 's',
			events: ['project.created'],
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'ep-2',
			workspaceId: 'ws-1',
			url: 'https://b.com',
			secret: 's',
			events: ['project.deleted'],
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'ep-3',
			workspaceId: 'ws-1',
			url: 'https://c.com',
			secret: 's',
			events: [],
			enabled: true,
			createdAt: new Date(),
		},
	);

	const d = new WebhookDispatcher(store as never);
	await d.dispatch({ workspaceId: 'ws-1' }, makeMeta('project.created'));

	// ep-1 (matches) + ep-3 (all events) should receive delivery — ep-2 should not
	const delivered = store.db.fonderie_webhook_deliveries.map((r) => r['endpointId']);
	assert.ok(delivered.includes('ep-1'));
	assert.ok(delivered.includes('ep-3'));
	assert.ok(!delivered.includes('ep-2'));
});

test('attemptDelivery: marks delivery as delivered on 2xx response', async () => {
	const store = makeStore();

	store.db.fonderie_webhook_deliveries.push({
		id: 'del-1',
		endpointId: 'ep-1',
		eventId: 'evt-1',
		eventType: 'project.created',
		payload: { workspaceId: 'ws-1' },
		status: 'pending',
		attempts: 0,
		responseStatus: null,
		responseBody: null,
		nextAttemptAt: null,
		deliveredAt: null,
		createdAt: new Date(),
	});

	const delivery = store.db.fonderie_webhook_deliveries[0]! as never;

	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('ok', { status: 200 }) as never;

	const d = new WebhookDispatcher(store as never, {});
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'https://example.com',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

	globalThis.fetch = origFetch;

	const updated = store.db.fonderie_webhook_deliveries[0]!;
	assert.equal(updated['status'], 'delivered');
	assert.equal(updated['attempts'], 1);
});

test('attemptDelivery: marks delivery as failed with next retry on non-2xx', async () => {
	const store = makeStore();

	store.db.fonderie_webhook_deliveries.push({
		id: 'del-1',
		endpointId: 'ep-1',
		eventId: 'evt-1',
		eventType: 'project.created',
		payload: { workspaceId: 'ws-1' },
		status: 'pending',
		attempts: 0,
		responseStatus: null,
		responseBody: null,
		nextAttemptAt: null,
		deliveredAt: null,
		createdAt: new Date(),
	});

	const delivery = store.db.fonderie_webhook_deliveries[0]! as never;

	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('error', { status: 500 }) as never;

	const d = new WebhookDispatcher(store as never, { maxAttempts: 3, retryDelays: [60_000] });
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'https://example.com',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

	globalThis.fetch = origFetch;

	const updated = store.db.fonderie_webhook_deliveries[0]!;
	assert.equal(updated['status'], 'failed');
	assert.ok(updated['nextAttemptAt'] !== null);
});

test('attemptDelivery: sets nextAttemptAt to null when max attempts exhausted', async () => {
	const store = makeStore();

	store.db.fonderie_webhook_deliveries.push({
		id: 'del-1',
		endpointId: 'ep-1',
		eventId: 'evt-1',
		eventType: 'project.created',
		payload: {},
		status: 'failed',
		attempts: 2, // already 2 attempts, max is 3
		responseStatus: null,
		responseBody: null,
		nextAttemptAt: null,
		deliveredAt: null,
		createdAt: new Date(),
	});

	const delivery = store.db.fonderie_webhook_deliveries[0]! as never;

	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('error', { status: 500 }) as never;

	const d = new WebhookDispatcher(store as never, { maxAttempts: 3 });
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'https://example.com',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

	globalThis.fetch = origFetch;

	const updated = store.db.fonderie_webhook_deliveries[0]!;
	assert.equal(updated['status'], 'failed');
	assert.equal(updated['nextAttemptAt'], null);
});

// ── bus integration ───────────────────────────────────────────────

test('bus: dispatcher receives events emitted via MemoryTransport', async () => {
	const transport = new MemoryTransport();
	const bus = new EventBus(transport);
	await bus.start();

	const store = makeStore();
	store.db.fonderie_webhook_endpoints.push({
		id: 'ep-1',
		workspaceId: 'ws-1',
		url: 'https://example.com',
		secret: 'sec',
		events: [],
		enabled: true,
		createdAt: new Date(),
	});

	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('ok', { status: 200 }) as never;

	const d = new WebhookDispatcher(store as never);
	bus.on<Record<string, unknown>>('*', (payload, meta) => d.dispatch(payload, meta), 'webhooks');

	await bus.emit('project.created', { workspaceId: 'ws-1', name: 'My Project' });

	globalThis.fetch = origFetch;

	assert.equal(store.db.fonderie_webhook_deliveries.length, 1);
});
