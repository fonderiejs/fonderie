import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryTransport } from '@fonderie/events';
import { EventBus } from '@fonderie/events';
import type { IEventMeta } from '@fonderie/events';

import { WebhookDispatcher } from '../dispatcher';
import { signPayload } from '../signing';
import {
	assertPublicHttpUrl,
	isBlockedAddress,
	resolvePinnedTarget,
	SsrfError,
	type IWebhookResponse,
	type WebhookTransport,
} from '../ssrf';

// Canned, call-recording delivery transport for hermetic tests — no DNS,
// no sockets. Replaces the old globalThis.fetch mock + pass-through guard.
function fakeTransport(
	result: Partial<IWebhookResponse> = {},
): WebhookTransport & { calls: Array<{ url: string; init: Parameters<WebhookTransport>[1] }> } {
	const calls: Array<{ url: string; init: Parameters<WebhookTransport>[1] }> = [];
	const fn = (async (url, init) => {
		calls.push({ url, init });
		return { ok: result.ok ?? true, status: result.status ?? 200, body: result.body ?? '' };
	}) as WebhookTransport & { calls: typeof calls };
	fn.calls = calls;
	return fn;
}

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

	const d = new WebhookDispatcher(store as never, {}, fakeTransport({ ok: true, status: 200 }));
	await d.dispatch({ workspaceId: 'ws-1' }, makeMeta('project.created'));

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

	const d = new WebhookDispatcher(store as never, {}, fakeTransport({ ok: true, status: 200 }));
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

	const d = new WebhookDispatcher(store as never, {}, fakeTransport({ ok: true, status: 200 }));
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'https://example.com',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

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

	const d = new WebhookDispatcher(
		store as never,
		{ maxAttempts: 3, retryDelays: [60_000] },
		fakeTransport({ ok: false, status: 500 }),
	);
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'https://example.com',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

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

	const d = new WebhookDispatcher(store as never, { maxAttempts: 3 }, fakeTransport({ ok: false, status: 500 }));
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'https://example.com',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

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

	const d = new WebhookDispatcher(store as never, {}, fakeTransport({ ok: true, status: 200 }));
	bus.on<Record<string, unknown>>('*', (payload, meta) => d.dispatch(payload, meta), 'webhooks');

	await bus.emit('project.created', { workspaceId: 'ws-1', name: 'My Project' });

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

	const transport = fakeTransport({ ok: true, status: 200 });
	await new WebhookDispatcher(store as never, {}, transport).retry();

	assert.equal(transport.calls.length, 1, 'the claimed delivery must be re-attempted');
	const { url, init } = transport.calls[0]!;
	assert.equal(url, 'https://hooks.example.com/sink');
	const sent = JSON.parse(init.body);
	assert.equal(sent.id, 'ev1');
	assert.equal(sent.type, 'user.created');
	assert.equal(init.headers['X-Webhook-Signature'], signPayload('whsec_retry', init.body));
	assert.equal(init.headers['X-Webhook-ID'], 'd1');

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
	assert.equal(isBlockedAddress('::ffff:127.0.0.1'), true); // IPv4-mapped loopback (dotted)
	assert.equal(isBlockedAddress('not-an-ip'), true); // fail closed
});

// ── Audit-3 W1/W2/W3: internal IPv4 embedded in IPv6 must NOT bypass ──
// The previous check only matched the DOTTED mapped form; the hex-colon,
// NAT64 and 6to4 embeddings sailed through and the OS routed them to the
// internal IPv4 (e.g. 169.254.169.254 cloud metadata).
test('isBlockedAddress: blocks internal IPv4 embedded in EVERY IPv6 notation', () => {
	// hex-colon IPv4-mapped
	assert.equal(isBlockedAddress('::ffff:a9fe:a9fe'), true); // 169.254.169.254 metadata
	assert.equal(isBlockedAddress('::ffff:7f00:0001'), true); // 127.0.0.1
	assert.equal(isBlockedAddress('::ffff:0a00:0001'), true); // 10.0.0.1
	assert.equal(isBlockedAddress('0:0:0:0:0:ffff:a9fe:a9fe'), true); // fully expanded
	// NAT64 well-known prefix 64:ff9b::/96
	assert.equal(isBlockedAddress('64:ff9b::a9fe:a9fe'), true);
	assert.equal(isBlockedAddress('64:ff9b::7f00:1'), true);
	// 6to4 2002::/16
	assert.equal(isBlockedAddress('2002:7f00:1::'), true); // 127.0.0.1
	assert.equal(isBlockedAddress('2002:a9fe:a9fe::'), true); // metadata
	// deprecated IPv4-compatible ::/96
	assert.equal(isBlockedAddress('::7f00:1'), true); // 127.0.0.1
	// public IPv4 embedded stays ALLOWED (no false-positive)
	assert.equal(isBlockedAddress('::ffff:8.8.8.8'), false);
	assert.equal(isBlockedAddress('::ffff:5050:5050'), false); // 80.80.80.80
	assert.equal(isBlockedAddress('2606:4700:4700::1111'), false); // real public IPv6
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

test('attemptDelivery: default (pinned) transport blocks an internal URL — delivery fails, no connect', async () => {
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

	// No injected transport — exercise the DEFAULT pinnedTransport. An internal
	// IP literal is rejected by resolvePinnedTarget BEFORE any socket connect,
	// so the delivery is marked failed with no response status.
	const d = new WebhookDispatcher(store as never, { maxAttempts: 3, retryDelays: [60_000] });
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery(
		'http://169.254.169.254/latest/meta-data',
		'secret',
		delivery,
		new DeliveryModel(store as never),
	);

	const updated = store.db.fonderie_webhook_deliveries[0]!;
	assert.equal(updated['status'], 'failed');
	assert.equal(updated['responseStatus'], null);
});

// ── DNS-rebind pin: resolvePinnedTarget validates AND returns the IP to
// bind the socket to (so a name that rebinds to an internal address after
// the check can never be connected to). No network — literals + validation.

test('resolvePinnedTarget: rejects internal/bad targets, pins a public IP literal', async () => {
	for (const bad of [
		'http://127.0.0.1/x',
		'http://169.254.169.254/latest/meta-data',
		'http://10.0.0.5/',
		'https://[::1]/',
		'ftp://example.com',
		'not a url',
	]) {
		await assert.rejects(resolvePinnedTarget(bad), SsrfError, bad);
	}
	const v4 = await resolvePinnedTarget('https://8.8.8.8/hook');
	assert.equal(v4.ip, '8.8.8.8');
	assert.equal(v4.family, 4);
	const v6 = await resolvePinnedTarget('http://[2606:4700:4700::1111]/');
	assert.equal(v6.family, 6);
});

// ── Security: delivery response bodies are capped (audit №2 M3) ──────
// The receiving endpoint is caller-controlled — its body must never be
// buffered unbounded. The cap lives in the transport (readCappedText); test
// it directly against a synthetic 1 MiB stream (loopback is blocked, so the
// transport can't be exercised against a local server).

test('readCappedText: truncates an oversized stream to the cap', async () => {
	const { readCappedText } = await import('../ssrf');
	const oneMiB = new TextEncoder().encode('x'.repeat(1024 * 1024));
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			// Emit in chunks to exercise the running-total cap.
			for (let i = 0; i < oneMiB.byteLength; i += 64 * 1024) {
				controller.enqueue(oneMiB.subarray(i, i + 64 * 1024));
			}
			controller.close();
		},
	});
	const out = await readCappedText(stream, 4 * 1024);
	assert.equal(out.length, 4 * 1024, 'read is capped at 4 KiB');
});

test('readCappedText: returns the full body when under the cap, and empty for no stream', async () => {
	const { readCappedText } = await import('../ssrf');
	const small = new ReadableStream<Uint8Array>({
		start(c) { c.enqueue(new TextEncoder().encode('ok')); c.close(); },
	});
	assert.equal(await readCappedText(small, 4 * 1024), 'ok');
	assert.equal(await readCappedText(null, 4 * 1024), '');
});

test('attemptDelivery: stores exactly the body the transport returns', async () => {
	const store = makeStore();
	store.db.fonderie_webhook_deliveries.push({
		id: 'del-1', endpointId: 'ep-1', eventId: 'evt-1', eventType: 'project.created',
		payload: { workspaceId: 'ws-1' }, status: 'pending', attempts: 0,
		responseStatus: null, responseBody: null, nextAttemptAt: null, deliveredAt: null,
		createdAt: new Date(),
	});
	const delivery = store.db.fonderie_webhook_deliveries[0]! as never;
	const d = new WebhookDispatcher(store as never, {}, fakeTransport({ ok: true, status: 200, body: 'stored-body' }));
	const { DeliveryModel } = await import('../models/delivery.model');
	await d.attemptDelivery('https://example.com', 'secret', delivery, new DeliveryModel(store as never));
	assert.equal(store.db.fonderie_webhook_deliveries[0]!['responseBody'], 'stored-body');
	assert.equal(store.db.fonderie_webhook_deliveries[0]!['status'], 'delivered');
});
