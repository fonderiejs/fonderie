import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryTransport } from '@fonderie/events';
import { EventBus } from '@fonderie/events';
import type { IEventMeta } from '@fonderie/events';

import { WebhookDispatcher } from '../dispatcher';
import { signPayload } from '../signing';
import { assertPublicHttpUrl, isBlockedAddress, SsrfError } from '../ssrf';

// Pass-through SSRF guard for tests that mock fetch — keeps them hermetic by
// skipping the real DNS lookup. The real guard is exercised separately below.
const PASS = async (): Promise<void> => {};

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

	const d = new WebhookDispatcher(store as never, {}, PASS);
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

	const origFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('ok', { status: 200 }) as never;

	const d = new WebhookDispatcher(store as never, {}, PASS);
	await d.dispatch({ workspaceId: 'ws-1' }, makeMeta('project.created'));

	globalThis.fetch = origFetch;

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

	const d = new WebhookDispatcher(store as never, {}, PASS);
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

	const d = new WebhookDispatcher(store as never, { maxAttempts: 3, retryDelays: [60_000] }, PASS);
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

	const d = new WebhookDispatcher(store as never, { maxAttempts: 3 }, PASS);
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

	const d = new WebhookDispatcher(store as never, {}, PASS);
	bus.on<Record<string, unknown>>('*', (payload, meta) => d.dispatch(payload, meta), 'webhooks');

	await bus.emit('project.created', { workspaceId: 'ws-1', name: 'My Project' });

	globalThis.fetch = origFetch;

	assert.equal(store.db.fonderie_webhook_deliveries.length, 1);
});

// ── audit closeout: delivery DTO carries what the query fetches ──

test('toDeliveryDTO: exposes payload, responseBody, and nextAttemptAt', async () => {
	const { toDeliveryDTO } = await import('../dtos/webhook');
	const dto = toDeliveryDTO({
		id: 'd1',
		endpointId: 'ep1',
		eventId: 'ev1',
		eventType: 'user.created',
		payload: { workspaceId: 'w1', name: 'Ada' },
		status: 'failed',
		attempts: 2,
		responseStatus: 500,
		responseBody: 'upstream boom',
		nextAttemptAt: new Date('2026-09-05T12:00:00.000Z'),
		deliveredAt: null,
		createdAt: new Date('2026-09-05T10:00:00.000Z'),
	} as never);
	assert.deepEqual(dto.payload, { workspaceId: 'w1', name: 'Ada' });
	assert.equal(dto.responseBody, 'upstream boom');
	assert.equal(dto.nextAttemptAt, '2026-09-05T12:00:00.000Z');
});

// ── retry ─────────────────────────────────────────────────────────
// The claim query returns FLAT rows (delivery columns + endpoint url/secret).
// IPendingRetry once claimed a nested { delivery, url, secret } shape no row
// ever produced — retry() then threw on `delivery.eventId` for every claimed
// row (swallowed by Promise.allSettled), so failed deliveries were re-claimed
// forever and never actually retried. This pins the working contract.

test('retry: a claimed failed delivery is actually re-attempted and marked delivered', async () => {
	const captured: { sql: string; params: unknown[] }[] = [];
	const flatRow = {
		id: 'd1',
		endpointId: 'ep1',
		eventId: 'ev1',
		eventType: 'user.created',
		payload: { workspaceId: 'w1' },
		status: 'failed',
		attempts: 1,
		responseStatus: 500,
		responseBody: '',
		nextAttemptAt: new Date(),
		deliveredAt: null,
		createdAt: new Date(),
		url: 'https://hooks.example.com/sink',
		secret: 'whsec_retry',
	};
	const store = {
		query: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
			captured.push({ sql, params: params ?? [] });
			if (sql.includes('JOIN') && sql.includes('fonderie_webhook_endpoints')) {
				return [flatRow] as unknown as T[];
			}
			return [] as T[];
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(store),
	};

	const fetchMock = mock.method(
		globalThis,
		'fetch',
		async () => new Response('ok', { status: 200 }),
	);
	try {
		await new WebhookDispatcher(store as never, {}, PASS).retry();
	} finally {
		fetchMock.mock.restore();
	}

	assert.equal(fetchMock.mock.callCount(), 1, 'the claimed delivery must be re-attempted');
	const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
	assert.equal(url, 'https://hooks.example.com/sink');
	const sent = JSON.parse(String(init.body));
	assert.equal(sent.id, 'ev1');
	assert.equal(sent.type, 'user.created');
	const headers = init.headers as Record<string, string>;
	assert.equal(headers['X-Webhook-Signature'], signPayload('whsec_retry', String(init.body)));
	assert.equal(headers['X-Webhook-ID'], 'd1');

	const update = captured.find((c) => c.sql.includes('UPDATE fonderie_webhook_deliveries'));
	assert.ok(update, 'markResult must record the outcome');
	assert.equal(update!.params[0], 'd1');
	assert.equal(update!.params[1], 'delivered');
});

// ── SSRF guard ────────────────────────────────────────────────────
// A webhook URL is attacker-controlled: without a guard, a member could point
// an endpoint at 169.254.169.254 (cloud metadata), 127.0.0.1, or an RFC1918
// host and use the server as a proxy into the internal network — then read the
// response back from the delivery log. These pin the guard. IP-literal cases
// need no DNS, so they're deterministic offline.

test('isBlockedAddress: public IPs pass, private/loopback/link-local/mapped are blocked', () => {
	assert.equal(isBlockedAddress('8.8.8.8'), false);
	assert.equal(isBlockedAddress('93.184.216.34'), false);
	assert.equal(isBlockedAddress('10.1.2.3'), true); // RFC1918
	assert.equal(isBlockedAddress('172.16.5.5'), true); // RFC1918
	assert.equal(isBlockedAddress('192.168.0.1'), true); // RFC1918
	assert.equal(isBlockedAddress('127.0.0.1'), true); // loopback
	assert.equal(isBlockedAddress('169.254.169.254'), true); // cloud metadata
	assert.equal(isBlockedAddress('100.64.1.1'), true); // CGNAT
	assert.equal(isBlockedAddress('0.0.0.0'), true); // this-host
	assert.equal(isBlockedAddress('::1'), true); // IPv6 loopback
	assert.equal(isBlockedAddress('fe80::1'), true); // IPv6 link-local
	assert.equal(isBlockedAddress('fd00::1'), true); // IPv6 ULA
	assert.equal(isBlockedAddress('::ffff:127.0.0.1'), true); // IPv4-mapped loopback
	assert.equal(isBlockedAddress('not-an-ip'), true); // fail closed
});

test('assertPublicHttpUrl: rejects non-http(s) schemes', async () => {
	for (const url of ['ftp://example.com', 'file:///etc/passwd', 'gopher://x', 'data:text/plain,x']) {
		await assert.rejects(assertPublicHttpUrl(url), SsrfError, url);
	}
});

test('assertPublicHttpUrl: rejects internal IP-literal hosts (no DNS)', async () => {
	for (const url of [
		'http://127.0.0.1/x',
		'http://169.254.169.254/latest/meta-data',
		'http://10.0.0.5:8080/',
		'http://192.168.1.1/',
		'https://[::1]/',
		'http://[fd00::1]/',
	]) {
		await assert.rejects(assertPublicHttpUrl(url), SsrfError, url);
	}
});

test('assertPublicHttpUrl: allows a public IP literal (no DNS)', async () => {
	await assert.doesNotReject(assertPublicHttpUrl('https://8.8.8.8/hook'));
});

test('assertPublicHttpUrl: rejects a malformed URL', async () => {
	await assert.rejects(assertPublicHttpUrl('not a url'), SsrfError);
});

test('attemptDelivery: real guard blocks an internal URL and never calls fetch', async () => {
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

	// No PASS here — exercise the DEFAULT (real) guard. fetch must never run.
	const fetchMock = mock.method(globalThis, 'fetch', async () => {
		throw new Error('fetch should not be called for a blocked URL');
	});
	try {
		const d = new WebhookDispatcher(store as never, { maxAttempts: 3, retryDelays: [60_000] });
		const { DeliveryModel } = await import('../models/delivery.model');
		await d.attemptDelivery(
			'http://169.254.169.254/latest/meta-data',
			'secret',
			delivery,
			new DeliveryModel(store as never),
		);
	} finally {
		fetchMock.mock.restore();
	}

	assert.equal(fetchMock.mock.callCount(), 0, 'fetch must not run for a blocked URL');
	const updated = store.db.fonderie_webhook_deliveries[0]!;
	assert.equal(updated['status'], 'failed');
	assert.equal(updated['responseStatus'], null);
});

// ── Security: delivery response bodies are capped at storage (audit №2 M3) ──
// The receiving endpoint is caller-controlled — an unbounded res.text() let it
// bloat memory and the deliveries table on every attempt.

test('attemptDelivery: oversized endpoint response is truncated before storage', async () => {
	const store = makeStore();
	store.db.fonderie_webhook_deliveries.push({
		id: 'del-1', endpointId: 'ep-1', eventId: 'evt-1', eventType: 'project.created',
		payload: { workspaceId: 'ws-1' }, status: 'pending', attempts: 0,
		responseStatus: null, responseBody: null, nextAttemptAt: null, deliveredAt: null,
		createdAt: new Date(),
	});
	const delivery = store.db.fonderie_webhook_deliveries[0]! as never;

	const huge = 'x'.repeat(1024 * 1024); // 1 MiB response
	const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(huge, { status: 200 }));
	try {
		const d = new WebhookDispatcher(store as never, {}, PASS);
		const { DeliveryModel } = await import('../models/delivery.model');
		await d.attemptDelivery('https://example.com', 'secret', delivery, new DeliveryModel(store as never));
	} finally {
		fetchMock.mock.restore();
	}
	const stored = store.db.fonderie_webhook_deliveries[0]!['responseBody'] as string;
	assert.ok(stored.length <= 4 * 1024, `stored ${stored.length} bytes — must be ≤ 4 KiB`);
	assert.equal(store.db.fonderie_webhook_deliveries[0]!['status'], 'delivered');
});
